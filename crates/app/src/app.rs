use std::cell::RefCell;
use std::collections::HashMap;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::rc::Rc;
use std::time::{Duration, Instant};

use std::sync::Arc;

use gpui::{
    Animation, AnimationExt as _, AnyElement, App, Bounds, ClickEvent, ClipboardItem, Context,
    CursorStyle, ElementId, Entity, FocusHandle, Focusable, FontWeight, ListAlignment, ListOffset,
    ListState, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, Pixels, Point,
    RenderImage, SharedString, Subscription, Window, actions, canvas, div, ease_out_quint, img,
    list, point, prelude::*, px, size,
};
use gyotaku_core::{Hit, Index, Line, Rect};

use crate::grid::{self, Row};
use crate::images::{self, Images, Lookup};
use crate::input::{Changed, TextInput};
use crate::spring::Spring;
use crate::theme::Theme;

actions!(
    gyotaku,
    [
        Back,
        Open,
        Up,
        Down,
        Left,
        Right,
        PageUp,
        PageDown,
        CopyText,
        CopyImage,
        OpenExternal,
        Reveal,
        Quit
    ]
);

const PAD: f32 = 16.0;
const GAP: f32 = 8.0;
const ROW_HEIGHT: f32 = 172.0;
const RADIUS: f32 = 10.0;
// Tiles sit PAD in from the panel edge, so the panel's corner is the tile's
// radius plus that distance and the two curves run parallel.
const PANEL_RADIUS: f32 = RADIUS + PAD;
const HEADER: f32 = 64.0;

const DETAIL_TOP: f32 = 56.0;
const DETAIL_BOTTOM: f32 = 52.0;
const DETAIL_PAD: f32 = 20.0;

// Motion is kept short everywhere: this is summoned, used and dismissed in a
// few seconds, dozens of times a day. Springs are in seconds of response,
// critically damped, and closing is quicker than opening.
const OPEN_RESPONSE: f32 = 0.26;
const CLOSE_RESPONSE: f32 = 0.2;
const FADE_RESPONSE: f32 = 0.14;
const PRESS: Duration = Duration::from_millis(110);
const THUMBS_KEPT_HIDDEN: usize = 40;
const TOAST_SHOWN: Duration = Duration::from_millis(1400);
const TOAST_FADE: Duration = Duration::from_millis(120);

const BROWSE_LIMIT: usize = 20_000;
const SEARCH_LIMIT: usize = 2_000;

// A few screens of thumbnails either side of where you are. A 480 px wide
// thumbnail is ~0.5 MB decoded, so this tops out around 60 MB.
const THUMB_CACHE: usize = 120;
const THUMB_MAX_SIDE: u32 = 1440;
// The full view keeps the one on screen and the one it just left, and never
// decodes past 4K on a side.
const FULL_CACHE: usize = 2;
const FULL_MAX_SIDE: u32 = 3840;

pub struct Gyotaku {
    index: Index,
    input: Entity<TextInput>,
    query: String,
    hits: Vec<Hit>,
    /// The lines each hit matched on, looked up the first time its tile is
    /// drawn rather than for every hit up front.
    matched: HashMap<i64, Rc<Vec<Line>>>,
    thumb_paths: Vec<PathBuf>,
    thumbs: Images,
    full: Images,
    searchable: usize,

    rows: Vec<Row>,
    located: Vec<(usize, usize)>,
    laid_out_for: f32,
    list: ListState,
    selected: usize,
    /// Bumped on every search so the ink press replays on the new results.
    generation: usize,
    /// Where each visible tile was painted last frame, for the open animation.
    tile_bounds: Rc<RefCell<HashMap<usize, Bounds<Pixels>>>>,

    detail: Option<Detail>,
    toast: Option<Toast>,
    toasts: usize,
    last_frame: Instant,
    /// Drawn as a floating panel (layer shell) rather than filling a window.
    floating: bool,
    appearance: Option<Subscription>,
    /// Scroll the selection back into view after the next layout, because
    /// relaying out the list loses its scroll position.
    reveal_selected: bool,
}

struct Toast {
    message: SharedString,
    id: usize,
    leaving: bool,
}

struct Detail {
    hit: usize,
    lines: Vec<Line>,
    matched: Vec<bool>,
    /// 0 is the tile in the grid, 1 is the full view.
    open: Spring,
    /// Whether it moves out of the tile, or just fades in place.
    grow: bool,
    from: Bounds<Pixels>,
    image_rect: Bounds<Pixels>,
    hovered: Option<usize>,
    drag: Option<(Point<Pixels>, Point<Pixels>)>,
    picked: Vec<usize>,
}

impl Gyotaku {
    pub fn new(index: Index, floating: bool, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let searchable = index.visible_len().unwrap_or(0);
        let input = cx.new(|cx| TextInput::new(placeholder(searchable), cx));
        cx.subscribe(&input, |this, _, _: &Changed, cx| this.search(cx))
            .detach();

        let mut this = Self {
            index,
            input,
            query: String::new(),
            hits: Vec::new(),
            matched: HashMap::new(),
            thumb_paths: Vec::new(),
            thumbs: Images::new(THUMB_CACHE, THUMB_MAX_SIDE),
            full: Images::new(FULL_CACHE, FULL_MAX_SIDE),
            searchable,
            rows: Vec::new(),
            located: Vec::new(),
            laid_out_for: 0.0,
            list: ListState::new(0, ListAlignment::Top, px(ROW_HEIGHT * 3.0)),
            selected: 0,
            generation: 0,
            tile_bounds: Rc::default(),
            detail: None,
            toast: None,
            toasts: 0,
            last_frame: Instant::now(),
            floating,
            appearance: None,
            reveal_selected: false,
        };
        this.attach(window, cx);
        this.search(cx);
        this
    }

    /// Everything that belongs to one particular window. The view outlives
    /// its windows (every summon is a new one), so this runs for each.
    fn attach(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        cx.set_global(Theme::for_appearance(window.appearance()));
        self.appearance = Some(cx.observe_window_appearance(window, |_, window, cx| {
            cx.set_global(Theme::for_appearance(window.appearance()));
            cx.notify();
        }));
        self.tile_bounds.borrow_mut().clear();
        self.last_frame = Instant::now();
    }

    /// Called when the same view is put into a new window, which is what
    /// makes it open exactly where it was left: same query, same selection,
    /// same scroll, even the same shot open. Only if screenshots arrived in
    /// the meantime are the results redone, keeping the selection.
    pub fn reopen(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.attach(window, cx);
        let searchable = self.index.visible_len().unwrap_or(self.searchable);
        if searchable != self.searchable {
            self.searchable = searchable;
            self.input.update(cx, |input, cx| {
                input.placeholder = placeholder(searchable);
                cx.notify();
            });
            self.refresh(cx);
        }
        cx.notify();
    }

    /// Hidden, keep about a screen of thumbnails so reopening is instant,
    /// and let the rest go.
    pub fn hidden(&mut self, cx: &mut Context<Self>) {
        self.thumbs.shrink_to(THUMBS_KEPT_HIDDEN, cx);
        self.full.shrink_to(1, cx);
    }

    /// Runs the current query again without resetting where you are.
    fn refresh(&mut self, cx: &mut Context<Self>) {
        let selected = self.hits.get(self.selected).map(|h| h.id);
        let open = self
            .detail
            .as_ref()
            .and_then(|d| self.hits.get(d.hit))
            .map(|h| h.id);

        self.load_hits(cx);
        let at = |id: Option<i64>| id.and_then(|id| self.hits.iter().position(|h| h.id == id));
        self.selected = at(selected).unwrap_or(0);
        match (at(open), self.detail.as_mut()) {
            (Some(ix), Some(d)) => d.hit = ix,
            _ => self.detail = None,
        }
        self.laid_out_for = 0.0;
        self.reveal_selected = true;
    }

    fn load_hits(&mut self, cx: &mut Context<Self>) {
        let query = self.input.read(cx).content.to_string();
        let limit = if query.trim().is_empty() {
            BROWSE_LIMIT
        } else {
            SEARCH_LIMIT
        };
        self.hits = self.index.find(&query, limit).unwrap_or_default();
        self.matched.clear();
        self.thumb_paths = self
            .hits
            .iter()
            .map(|h| gyotaku_core::thumb_path(&h.path).unwrap_or_default())
            .collect();
        self.query = query;
    }

    fn search(&mut self, cx: &mut Context<Self>) {
        self.load_hits(cx);
        self.generation += 1;
        self.selected = 0;
        self.laid_out_for = 0.0;
        self.detail = None;
        self.list.scroll_to(ListOffset::default());
        cx.notify();
    }

    /// The decoded image for a path, or None while it decodes in the
    /// background (the view repaints when it lands).
    fn image(
        &mut self,
        path: &Path,
        full: bool,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Option<Arc<RenderImage>> {
        let store = if full {
            &mut self.full
        } else {
            &mut self.thumbs
        };
        let max_side = match store.get(path, window, cx) {
            Lookup::Ready(image) => return Some(image),
            Lookup::Pending => return None,
            Lookup::Start(max_side) => max_side,
        };
        let path = path.to_owned();
        cx.spawn(async move |this, cx| {
            let decoding = path.clone();
            let image = cx
                .background_executor()
                .spawn(async move { images::decode(&decoding, max_side) })
                .await;
            let _ = this.update(cx, |this, cx| {
                let store = if full {
                    &mut this.full
                } else {
                    &mut this.thumbs
                };
                store.finish(&path, image);
                cx.notify();
            });
        })
        .detach();
        None
    }

    fn matched_lines(&mut self, item: usize) -> Rc<Vec<Line>> {
        let Some(hit) = self.hits.get(item) else {
            return Rc::default();
        };
        if !self.searching() {
            return Rc::default();
        }
        let (index, query) = (&self.index, &self.query);
        self.matched
            .entry(hit.id)
            .or_insert_with(|| Rc::new(index.matching_lines(hit.id, query).unwrap_or_default()))
            .clone()
    }

    fn corner(&self) -> Pixels {
        if self.floating {
            px(PANEL_RADIUS)
        } else {
            px(0.)
        }
    }

    fn searching(&self) -> bool {
        !self.query.trim().is_empty()
    }

    fn relayout(&mut self, width: f32) {
        let aspects: Vec<f32> = self
            .hits
            .iter()
            .map(|h| gyotaku_core::tile_aspect(h.width, h.height))
            .collect();
        self.rows = grid::justify(&aspects, width, ROW_HEIGHT, GAP);
        self.located = grid::locate(&self.rows, self.hits.len());
        self.laid_out_for = width;
        self.list.reset(self.rows.len());
        if std::mem::take(&mut self.reveal_selected)
            && let Some(&(row, _)) = self.located.get(self.selected)
        {
            self.list.scroll_to_reveal_item(row);
        }
    }

    fn select(&mut self, item: Option<usize>, cx: &mut Context<Self>) {
        let Some(item) = item.filter(|i| *i < self.hits.len()) else {
            return;
        };
        self.selected = item;
        if let Some(&(row, _)) = self.located.get(item) {
            self.list.scroll_to_reveal_item(row);
        }
        if self.detail.is_some() {
            self.show(item, cx);
        }
        cx.notify();
    }

    // Actions. They're bound at the root, so they arrive whether the search
    // field or anything else has focus.

    fn back(&mut self, _: &Back, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(d) = &mut self.detail {
            if d.grow {
                d.open.set_response(CLOSE_RESPONSE, 1.0);
            }
            d.open.set_target(0.0);
            self.last_frame = Instant::now();
        } else if self.searching() {
            self.input.update(cx, |input, cx| input.clear(cx));
        } else {
            // Resident, this just hides. With --once it's the last window
            // and the app exits with it.
            window.remove_window();
        }
        cx.notify();
    }

    /// Enter opens the full view, and from there, the file itself.
    fn open(&mut self, _: &Open, _: &mut Window, cx: &mut Context<Self>) {
        if self.detail.as_ref().is_some_and(|d| d.open.target() == 1.0) {
            self.open_selected(cx);
        } else {
            self.show(self.selected, cx);
        }
    }

    fn up(&mut self, _: &Up, _: &mut Window, cx: &mut Context<Self>) {
        if self.detail.is_none() {
            let to = self
                .located
                .get(self.selected)
                .and_then(|&at| grid::vertical(&self.rows, at, false));
            self.select(to, cx);
        }
    }

    fn down(&mut self, _: &Down, _: &mut Window, cx: &mut Context<Self>) {
        if self.detail.is_none() {
            let to = self
                .located
                .get(self.selected)
                .and_then(|&at| grid::vertical(&self.rows, at, true));
            self.select(to, cx);
        }
    }

    fn left(&mut self, _: &Left, _: &mut Window, cx: &mut Context<Self>) {
        self.select(self.selected.checked_sub(1), cx);
    }

    fn right(&mut self, _: &Right, _: &mut Window, cx: &mut Context<Self>) {
        self.select(Some(self.selected + 1), cx);
    }

    fn page(&mut self, down: bool, cx: &mut Context<Self>) {
        let mut at = self.selected;
        for _ in 0..4 {
            match self
                .located
                .get(at)
                .and_then(|&loc| grid::vertical(&self.rows, loc, down))
            {
                Some(next) => at = next,
                None => break,
            }
        }
        self.select(Some(at), cx);
    }

    fn page_up(&mut self, _: &PageUp, _: &mut Window, cx: &mut Context<Self>) {
        self.page(false, cx);
    }

    fn page_down(&mut self, _: &PageDown, _: &mut Window, cx: &mut Context<Self>) {
        self.page(true, cx);
    }

    fn copy_text(&mut self, _: &CopyText, _: &mut Window, cx: &mut Context<Self>) {
        let lines = match &self.detail {
            Some(d) if !d.picked.is_empty() => {
                d.picked.iter().map(|&i| d.lines[i].clone()).collect()
            }
            Some(d) => d.lines.clone(),
            None => match self.hits.get(self.selected) {
                Some(hit) => self.index.lines(hit.id).unwrap_or_default(),
                None => return,
            },
        };
        if lines.is_empty() {
            self.flash("no text in this one", cx);
            return;
        }
        let text = lines
            .iter()
            .map(|l| l.text.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        copy_text(&text, cx);
        let what = if lines.len() == 1 {
            "copied 1 line".into()
        } else {
            format!("copied {} lines", lines.len())
        };
        self.flash(what, cx);
    }

    fn copy_image(&mut self, _: &CopyImage, _: &mut Window, cx: &mut Context<Self>) {
        let Some(hit) = self.hits.get(self.selected) else {
            return;
        };
        let message = if copy_image(&hit.path) {
            "copied the image"
        } else {
            "couldn't copy the image, is wl-copy installed?"
        };
        self.flash(message, cx);
    }

    fn open_external(&mut self, _: &OpenExternal, _: &mut Window, cx: &mut Context<Self>) {
        self.open_selected(cx);
    }

    fn open_selected(&self, cx: &mut Context<Self>) {
        if let Some(hit) = self.hits.get(self.selected) {
            cx.open_with_system(&hit.path);
        }
    }

    fn reveal(&mut self, _: &Reveal, _: &mut Window, cx: &mut Context<Self>) {
        if let Some(hit) = self.hits.get(self.selected) {
            cx.reveal_path(&hit.path);
        }
    }

    fn quit(&mut self, _: &Quit, _: &mut Window, cx: &mut Context<Self>) {
        cx.quit();
    }

    /// Opens the full view of a shot, or switches to it if one is already open.
    fn show(&mut self, item: usize, cx: &mut Context<Self>) {
        let Some(id) = self.hits.get(item).map(|h| h.id) else {
            return;
        };
        let hits_here = self.matched_lines(item);
        let lines = self.index.lines(id).unwrap_or_default();
        let matched = lines.iter().map(|l| hits_here.contains(l)).collect();
        self.selected = item;

        if let Some(d) = &mut self.detail {
            d.hit = item;
            d.lines = lines;
            d.matched = matched;
            d.hovered = None;
            d.picked.clear();
            if d.grow {
                d.open.set_response(OPEN_RESPONSE, 1.0);
            }
            d.open.set_target(1.0);
        } else {
            let tile = self.tile_bounds.borrow().get(&item).copied();
            let from = tile.unwrap_or_else(|| {
                Bounds::centered_at(point(px(400.), px(300.)), size(px(80.), px(60.)))
            });
            // With reduced motion the shot doesn't fly out of its tile, it
            // fades in where it's going to be.
            let grow = !cx.reduce_motion();
            let mut open = Spring::new(0.0, if grow { OPEN_RESPONSE } else { FADE_RESPONSE }, 1.0);
            open.set_target(1.0);
            self.detail = Some(Detail {
                hit: item,
                lines,
                matched,
                open,
                grow,
                from,
                image_rect: from,
                hovered: None,
                drag: None,
                picked: Vec::new(),
            });
        }
        self.last_frame = Instant::now();
        cx.notify();
    }

    fn flash(&mut self, message: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.toasts += 1;
        let id = self.toasts;
        self.toast = Some(Toast {
            message: message.into(),
            id,
            leaving: false,
        });
        cx.spawn(async move |this, cx| {
            // Shown, then faded out, then gone. A newer toast takes over and
            // this one's timers do nothing.
            for leaving in [true, false] {
                let wait = if leaving { TOAST_SHOWN } else { TOAST_FADE };
                cx.background_executor().timer(wait).await;
                let _ = this.update(cx, |this, cx| {
                    let Some(toast) = this.toast.as_mut().filter(|t| t.id == id) else {
                        return;
                    };
                    if leaving {
                        toast.leaving = true;
                    } else {
                        this.toast = None;
                    }
                    cx.notify();
                });
            }
        })
        .detach();
        cx.notify();
    }

    // The full view's mouse handling. Hovering shows which line is under the
    // pointer, clicking copies it, dragging copies every line the box touches.

    fn line_at(&self, p: Point<Pixels>) -> Option<usize> {
        let d = self.detail.as_ref()?;
        d.lines
            .iter()
            .position(|l| on_screen(l.rect, d.image_rect).contains(&p))
    }

    fn detail_mouse_move(&mut self, e: &MouseMoveEvent, _: &mut Window, cx: &mut Context<Self>) {
        let hovered = self.line_at(e.position);
        let Some(d) = &mut self.detail else { return };
        if let Some((start, _)) = d.drag {
            d.drag = Some((start, e.position));
            let area = Bounds::from_corners(start.min(&e.position), start.max(&e.position));
            d.picked = (0..d.lines.len())
                .filter(|&i| on_screen(d.lines[i].rect, d.image_rect).intersects(&area))
                .collect();
            cx.notify();
        } else if d.hovered != hovered {
            d.hovered = hovered;
            cx.notify();
        }
    }

    fn detail_mouse_down(&mut self, e: &MouseDownEvent, _: &mut Window, cx: &mut Context<Self>) {
        if let Some(d) = &mut self.detail {
            d.drag = Some((e.position, e.position));
            d.picked.clear();
            cx.notify();
        }
    }

    fn detail_mouse_up(&mut self, e: &MouseUpEvent, window: &mut Window, cx: &mut Context<Self>) {
        let clicked = self.line_at(e.position);
        let Some(d) = &mut self.detail else { return };
        let Some((start, _)) = d.drag.take() else {
            return;
        };
        let dragged =
            (e.position.x - start.x).abs() > px(4.) || (e.position.y - start.y).abs() > px(4.);
        if !dragged {
            d.picked = clicked.into_iter().collect();
        }
        if d.picked.is_empty() {
            cx.notify();
            return;
        }
        self.copy_text(&CopyText, window, cx);
    }

    fn render_row(&mut self, ix: usize, window: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        let Some(row) = self.rows.get(ix) else {
            return div().into_any_element();
        };
        let height = row.height;
        let tiles: Vec<AnyElement> = row
            .tiles
            .clone()
            .into_iter()
            .map(|t| self.render_tile(t.item, t.width, height, window, cx))
            .collect();
        div()
            .flex()
            .gap(px(GAP))
            .px(px(PAD))
            .py(px(GAP / 2.0))
            .children(tiles)
            .into_any_element()
    }

    fn render_tile(
        &mut self,
        i: usize,
        w: f32,
        h: f32,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> AnyElement {
        let theme = *cx.global::<Theme>();
        let path = self.thumb_paths[i].clone();
        let thumb = self.image(&path, false, window, cx);
        let lines = self.matched_lines(i);
        let hit = &self.hits[i];
        let crop = gyotaku_core::tile_crop(hit.width, hit.height);
        let sink = self.tile_bounds.clone();

        let mut tile = div()
            .id(("tile", i))
            .relative()
            .flex_none()
            .w(px(w))
            .h(px(h))
            .rounded(px(RADIUS))
            .bg(theme.tile)
            .cursor(CursorStyle::PointingHand)
            .children(
                thumb
                    .clone()
                    .map(|t| img(t).absolute().size_full().rounded(px(RADIUS))),
            );

        // The ink press: the whole print darkens and only the words that
        // matched stay lit, each one a window cut through the veil back to
        // the thumbnail underneath.
        if let Some(thumb) = thumb.filter(|_| !lines.is_empty()) {
            tile = tile.child(
                div()
                    .absolute()
                    .size_full()
                    .rounded(px(RADIUS))
                    .bg(theme.veil),
            );
            for (j, line) in lines.iter().enumerate() {
                let Some(b) = in_tile(line.rect, crop, w, h) else {
                    continue;
                };
                let lit = div()
                    .absolute()
                    .left(px(b.x))
                    .top(px(b.y))
                    .w(px(b.w))
                    .h(px(b.h))
                    .overflow_hidden()
                    .rounded(px(3.))
                    .border_1()
                    .border_color(theme.accent)
                    .child(
                        img(thumb.clone())
                            .absolute()
                            .left(px(-b.x - 1.))
                            .top(px(-b.y - 1.))
                            .w(px(w))
                            .h(px(h)),
                    );
                // This replays on every keystroke, so it stays short: typing
                // is the most frequent thing anyone does here.
                if cx.reduce_motion() {
                    tile = tile.child(lit);
                } else {
                    let id = ElementId::Name(format!("press-{}-{i}-{j}", self.generation).into());
                    tile = tile.child(lit.with_animation(
                        id,
                        Animation::new(PRESS).with_easing(ease_out_quint()),
                        |el, t| el.opacity(t),
                    ));
                }
            }
        }

        tile = tile.child(
            div()
                .absolute()
                .size_full()
                .rounded(px(RADIUS))
                .border_1()
                .border_color(theme.image_edge),
        );

        if i == self.selected {
            // Offset outward by 3 px, so the radius grows by 3 too, the ring
            // stays concentric with the tile's corners.
            tile = tile.child(
                div()
                    .absolute()
                    .top(px(-3.))
                    .left(px(-3.))
                    .w(px(w + 6.))
                    .h(px(h + 6.))
                    .rounded(px(RADIUS + 3.))
                    .border_2()
                    .border_color(theme.text),
            );
        }

        tile.child(
            canvas(
                move |bounds, _, _| sink.borrow_mut().insert(i, bounds),
                |_, _, _, _| {},
            )
            .absolute()
            .size_full(),
        )
        .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| {
            this.selected = i;
            this.show(i, cx);
        }))
        .into_any_element()
    }

    fn render_header(&self, theme: Theme) -> impl IntoElement + use<> {
        // While searching, how many matched. While browsing, when the selected
        // one was taken, which is the one thing the grid itself can't show.
        let count = if self.searching() {
            let n = self.hits.len();
            match n {
                0 => String::new(),
                SEARCH_LIMIT.. => format!("{}+", thousands(n)),
                _ => thousands(n),
            }
        } else {
            self.hits
                .get(self.selected)
                .map(|h| taken_at(h.mtime))
                .unwrap_or_default()
        };
        div()
            .flex_none()
            .h(px(HEADER))
            .flex()
            .items_center()
            .gap_4()
            .px(px(PAD + 8.))
            .border_b_1()
            .border_color(theme.hairline)
            .child(
                div()
                    .flex_1()
                    .text_size(px(21.))
                    .line_height(px(30.))
                    .child(self.input.clone()),
            )
            .child(div().text_sm().text_color(theme.muted).child(count))
    }

    fn render_empty(&self, theme: Theme) -> impl IntoElement + use<> {
        let (title, body): (SharedString, SharedString) = if self.searchable == 0 {
            (
                "nothing indexed yet".into(),
                "run gyotaku watch and screenshots show up here as they're read".into(),
            )
        } else {
            (
                format!("nothing says \u{201c}{}\u{201d}", self.query.trim()).into(),
                "fewer letters usually finds it, the middle of a word works too".into(),
            )
        };
        div()
            .flex_1()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .gap_1()
            .pb(px(HEADER))
            .child(div().text_lg().font_weight(FontWeight::MEDIUM).child(title))
            .child(div().text_sm().text_color(theme.muted).child(body))
    }

    fn render_scrollbar(&self, theme: Theme) -> Option<impl IntoElement + use<>> {
        let max = self.list.max_offset_for_scrollbar().y.as_f32();
        let viewport = self.list.viewport_bounds();
        let height = viewport.size.height.as_f32();
        if max <= 1.0 || height <= 0.0 {
            return None;
        }
        let offset = (-self.list.scroll_px_offset_for_scrollbar().y.as_f32()).clamp(0.0, max);
        let thumb = (height * height / (height + max)).max(28.0);
        let top = (height - thumb) * offset / max;
        Some(
            div()
                .absolute()
                .right(px(4.))
                .top(px(HEADER + top))
                .w(px(4.))
                .h(px(thumb))
                .rounded_full()
                .bg(theme.faint)
                .opacity(0.5),
        )
    }

    fn render_detail(&mut self, window: &mut Window, cx: &mut Context<Self>) -> Option<AnyElement> {
        let theme = *cx.global::<Theme>();
        let viewport = window.viewport_size();
        let corner = self.corner();
        let shown = self.detail.as_ref()?.hit;
        let thumb_path = self.thumb_paths.get(shown)?.clone();
        let full_path = self.hits.get(shown)?.path.clone();
        let thumb = self.image(&thumb_path, false, window, cx);
        let full = self.image(&full_path, true, window, cx);
        let d = self.detail.as_mut()?;
        let hit = self.hits.get(d.hit)?;
        let p = d.open.value;

        let area = Bounds::new(
            point(px(DETAIL_PAD), px(DETAIL_TOP)),
            size(
                viewport.width - px(DETAIL_PAD * 2.),
                viewport.height - px(DETAIL_TOP + DETAIL_BOTTOM),
            ),
        );
        let scale = window.scale_factor();
        let native = (hit.width as f32 / scale, hit.height as f32 / scale);
        let target = fit(hit.width as f32 / hit.height.max(1) as f32, area, native);
        // The tile only shows the crop, so the full image starts out as the
        // rectangle that would put the crop exactly where the tile was.
        let crop = gyotaku_core::tile_crop(hit.width, hit.height);
        let from = Bounds::new(
            point(
                d.from.origin.x - d.from.size.width * (crop.x / crop.w),
                d.from.origin.y - d.from.size.height * (crop.y / crop.h),
            ),
            size(d.from.size.width / crop.w, d.from.size.height / crop.h),
        );
        let (rect, fade) = if d.grow {
            (lerp_bounds(from, target, p), 1.0)
        } else {
            (target, p.clamp(0.0, 1.0))
        };
        d.image_rect = rect;
        let chrome = ((p - 0.4) / 0.6).clamp(0.0, 1.0);

        let thumb_rect = Bounds::new(
            point(
                rect.origin.x + rect.size.width * crop.x,
                rect.origin.y + rect.size.height * crop.y,
            ),
            size(rect.size.width * crop.w, rect.size.height * crop.h),
        );
        let radius = px(RADIUS + (6.0 - RADIUS) * p);

        let mut boxes = Vec::new();
        for (i, line) in d.lines.iter().enumerate() {
            let b = on_screen(line.rect, rect).dilate(px(3.));
            // Same rule as the grid: what the search found is shu, what you
            // selected is ink.
            let (bg, border) = if d.picked.contains(&i) {
                (theme.hover_wash, Some(theme.text))
            } else if d.matched.get(i).copied().unwrap_or(false) {
                (theme.accent_wash, Some(theme.accent))
            } else if d.hovered == Some(i) {
                (theme.hover_wash, None)
            } else {
                continue;
            };
            let mut el = div()
                .absolute()
                .left(b.origin.x)
                .top(b.origin.y)
                .w(b.size.width)
                .h(b.size.height)
                .rounded(px(4.))
                .bg(bg);
            if let Some(border) = border {
                el = el.border_1().border_color(border);
            }
            boxes.push(el.opacity(chrome));
        }

        let drag = d
            .drag
            .filter(|(a, b)| (a.x - b.x).abs() > px(4.) || (a.y - b.y).abs() > px(4.))
            .map(|(a, b)| {
                let r = Bounds::from_corners(a.min(&b), a.max(&b));
                div()
                    .absolute()
                    .left(r.origin.x)
                    .top(r.origin.y)
                    .w(r.size.width)
                    .h(r.size.height)
                    .rounded(px(3.))
                    .border_1()
                    .border_color(theme.accent)
                    .bg(theme.accent_wash)
                    .opacity(0.6)
            });

        let name = hit
            .path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let when = taken_at(hit.mtime);

        Some(
            div()
                .id("detail")
                .absolute()
                .size_full()
                .occlude()
                .cursor(if d.hovered.is_some() {
                    CursorStyle::PointingHand
                } else {
                    CursorStyle::Arrow
                })
                .on_mouse_move(cx.listener(Self::detail_mouse_move))
                .on_mouse_down(MouseButton::Left, cx.listener(Self::detail_mouse_down))
                .on_mouse_up(MouseButton::Left, cx.listener(Self::detail_mouse_up))
                .child(
                    div()
                        .absolute()
                        .size_full()
                        .rounded(corner)
                        .bg(theme.panel)
                        .opacity(p.clamp(0.0, 1.0)),
                )
                // The thumbnail is already decoded, so it carries the move
                // until the full size image lands on top of it.
                .children(thumb.map(|t| {
                    img(t)
                        .absolute()
                        .left(thumb_rect.origin.x)
                        .top(thumb_rect.origin.y)
                        .w(thumb_rect.size.width)
                        .h(thumb_rect.size.height)
                        .rounded(radius)
                        .opacity(fade)
                }))
                .children(full.map(|f| {
                    img(f)
                        .absolute()
                        .left(rect.origin.x)
                        .top(rect.origin.y)
                        .w(rect.size.width)
                        .h(rect.size.height)
                        .rounded(radius)
                        .opacity(fade)
                }))
                .children(boxes)
                .children(drag)
                .child(
                    div()
                        .absolute()
                        .top_0()
                        .left_0()
                        .right_0()
                        .h(px(DETAIL_TOP))
                        .px(px(DETAIL_PAD + 4.))
                        .flex()
                        .items_center()
                        .justify_between()
                        .opacity(chrome)
                        .child(
                            div()
                                .font_weight(FontWeight::MEDIUM)
                                .text_ellipsis()
                                .child(name),
                        )
                        .child(div().text_sm().text_color(theme.muted).child(when)),
                )
                .child(
                    div()
                        .absolute()
                        .bottom_0()
                        .left_0()
                        .right_0()
                        .h(px(DETAIL_BOTTOM))
                        .flex()
                        .items_center()
                        .justify_center()
                        .gap_5()
                        .opacity(chrome)
                        .child(hint("esc", "back", theme))
                        .child(hint("ctrl c", "copy text", theme))
                        .child(hint("ctrl shift c", "copy image", theme))
                        .child(hint("enter", "open", theme))
                        .child(hint("\u{2190} \u{2192}", "next", theme)),
                )
                .into_any_element(),
        )
    }

    fn render_toast(&self, theme: Theme) -> Option<impl IntoElement + use<>> {
        let toast = self.toast.as_ref()?;
        let (id, leaving) = (toast.id, toast.leaving);
        // The fade out has its own id so it starts fresh instead of carrying
        // on from where the fade in ended.
        let phase = if leaving { "out" } else { "in" };
        Some(
            div()
                .absolute()
                .bottom(px(DETAIL_BOTTOM + 12.))
                .left_0()
                .right_0()
                .flex()
                .justify_center()
                .child(
                    div()
                        .px_4()
                        .py_2()
                        .rounded_full()
                        .bg(theme.text)
                        .text_color(theme.panel)
                        .text_sm()
                        .child(toast.message.clone())
                        .with_animation(
                            ElementId::Name(format!("toast-{id}-{phase}").into()),
                            Animation::new(TOAST_FADE).with_easing(ease_out_quint()),
                            move |el, t| el.opacity(if leaving { 1.0 - t } else { t }),
                        ),
                ),
        )
    }
}

impl Focusable for Gyotaku {
    fn focus_handle(&self, cx: &App) -> FocusHandle {
        self.input.focus_handle(cx)
    }
}

impl Render for Gyotaku {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = *cx.global::<Theme>();

        let now = Instant::now();
        let dt = now
            .duration_since(self.last_frame)
            .as_secs_f32()
            .min(1.0 / 30.0);
        self.last_frame = now;
        if let Some(d) = &mut self.detail {
            if !d.open.is_settled() {
                d.open.step(dt);
                window.request_animation_frame();
            } else if d.open.target() == 0.0 {
                self.detail = None;
            }
        }

        let width = window.viewport_size().width.as_f32() - PAD * 2.0;
        if (width - self.laid_out_for).abs() > 0.5 && width > 0.0 {
            self.relayout(width);
        }

        let body: AnyElement = if self.hits.is_empty() {
            self.render_empty(theme).into_any_element()
        } else {
            list(self.list.clone(), cx.processor(Self::render_row))
                .flex_1()
                .size_full()
                .pt(px(6.))
                .into_any_element()
        };

        let detail = self.render_detail(window, cx);
        let scrollbar = self.render_scrollbar(theme);
        let toast = self.render_toast(theme);
        let header = self.render_header(theme);

        div()
            .key_context("Gyotaku")
            .on_action(cx.listener(Self::back))
            .on_action(cx.listener(Self::open))
            .on_action(cx.listener(Self::up))
            .on_action(cx.listener(Self::down))
            .on_action(cx.listener(Self::left))
            .on_action(cx.listener(Self::right))
            .on_action(cx.listener(Self::page_up))
            .on_action(cx.listener(Self::page_down))
            .on_action(cx.listener(Self::copy_text))
            .on_action(cx.listener(Self::copy_image))
            .on_action(cx.listener(Self::open_external))
            .on_action(cx.listener(Self::reveal))
            .on_action(cx.listener(Self::quit))
            .relative()
            .size_full()
            .flex()
            .flex_col()
            .overflow_hidden()
            .bg(theme.panel)
            .rounded(self.corner())
            .when(self.floating, |panel| {
                panel.border_1().border_color(theme.hairline)
            })
            .text_color(theme.text)
            .font_family("IBM Plex Sans")
            .child(header)
            .child(body)
            .children(scrollbar)
            .children(detail)
            .children(toast)
    }
}

fn hint(keys: &'static str, what: &'static str, theme: Theme) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .gap_2()
        .text_xs()
        .child(
            div()
                .px(px(6.))
                .py(px(1.))
                .rounded(px(5.))
                .bg(theme.keycap)
                .border_1()
                .border_color(theme.hairline)
                .text_color(theme.text)
                .child(keys),
        )
        .child(div().text_color(theme.muted).child(what))
}

/// A line's box in tile pixels, grown a little so the outline doesn't sit on
/// the glyphs. None when the line falls outside the part the tile shows.
fn in_tile(r: Rect, crop: Rect, w: f32, h: f32) -> Option<Rect> {
    const GROW: f32 = 2.0;
    let x0 = ((r.x - crop.x) / crop.w * w - GROW).max(0.0);
    let y0 = ((r.y - crop.y) / crop.h * h - GROW).max(0.0);
    let x1 = ((r.x + r.w - crop.x) / crop.w * w + GROW).min(w);
    let y1 = ((r.y + r.h - crop.y) / crop.h * h + GROW).min(h);
    (x1 - x0 >= 3.0 && y1 - y0 >= 3.0).then_some(Rect {
        x: x0,
        y: y0,
        w: x1 - x0,
        h: y1 - y0,
    })
}

fn on_screen(r: Rect, image: Bounds<Pixels>) -> Bounds<Pixels> {
    Bounds::new(
        point(
            image.origin.x + image.size.width * r.x,
            image.origin.y + image.size.height * r.y,
        ),
        size(image.size.width * r.w, image.size.height * r.h),
    )
}

/// The largest rectangle of this aspect that fits in `area`, centred, but no
/// bigger than `native` (the screenshot's own size in logical pixels). A
/// small crop blown up to fill the window just looks broken.
fn fit(aspect: f32, area: Bounds<Pixels>, native: (f32, f32)) -> Bounds<Pixels> {
    let (aw, ah) = (area.size.width.as_f32(), area.size.height.as_f32());
    let (w, h) = if aw / ah > aspect {
        (ah * aspect, ah)
    } else {
        (aw, aw / aspect)
    };
    let shrink = (native.0 / w).min(native.1 / h).min(1.0);
    let (w, h) = (w * shrink, h * shrink);
    Bounds::new(
        point(
            area.origin.x + px((aw - w) / 2.0),
            area.origin.y + px((ah - h) / 2.0),
        ),
        size(px(w), px(h)),
    )
}

fn lerp_bounds(a: Bounds<Pixels>, b: Bounds<Pixels>, t: f32) -> Bounds<Pixels> {
    let l = |x: Pixels, y: Pixels| x + (y - x) * t;
    Bounds::new(
        point(l(a.origin.x, b.origin.x), l(a.origin.y, b.origin.y)),
        size(
            l(a.size.width, b.size.width),
            l(a.size.height, b.size.height),
        ),
    )
}

fn placeholder(searchable: usize) -> SharedString {
    match searchable {
        0 => "nothing to search yet".into(),
        1 => "search 1 screenshot".into(),
        n => format!("search {} screenshots", thousands(n)).into(),
    }
}

fn thousands(n: usize) -> String {
    let digits = n.to_string();
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn taken_at(mtime: i64) -> String {
    jiff::Timestamp::from_second(mtime)
        .map(|t| {
            t.to_zoned(jiff::tz::TimeZone::system())
                .strftime("%-d %b %Y, %H:%M")
                .to_string()
        })
        .unwrap_or_default()
}

// A Wayland clipboard is served by the app that set it, so text copied with
// gpui's own clipboard vanishes the moment this window closes. wl-copy forks
// a tiny process that keeps serving it, which is what makes "copy, esc,
// paste" work.
fn copy_text(text: &str, cx: &mut App) {
    if std::env::var_os("WAYLAND_DISPLAY").is_some() && pipe("wl-copy", &[], text.as_bytes()) {
        return;
    }
    cx.write_to_clipboard(ClipboardItem::new_string(text.to_owned()));
}

fn copy_image(path: &Path) -> bool {
    let mime = match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "image/png",
    };
    let Ok(bytes) = std::fs::read(path) else {
        return false;
    };
    if std::env::var_os("WAYLAND_DISPLAY").is_some() {
        pipe("wl-copy", &["--type", mime], &bytes)
    } else {
        pipe("xclip", &["-selection", "clipboard", "-t", mime], &bytes)
    }
}

fn pipe(program: &str, args: &[&str], input: &[u8]) -> bool {
    let Ok(mut child) = Command::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return false;
    };
    let wrote = child
        .stdin
        .take()
        .is_some_and(|mut stdin| stdin.write_all(input).is_ok());
    child.wait().is_ok_and(|s| s.success()) && wrote
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thousands_separators() {
        assert_eq!(thousands(0), "0");
        assert_eq!(thousands(999), "999");
        assert_eq!(thousands(1000), "1,000");
        assert_eq!(thousands(5159), "5,159");
        assert_eq!(thousands(1234567), "1,234,567");
    }

    #[test]
    fn boxes_outside_the_crop_are_dropped() {
        let crop = Rect {
            x: 0.0,
            y: 0.0,
            w: 1.0,
            h: 0.5,
        };
        let below = Rect {
            x: 0.1,
            y: 0.7,
            w: 0.3,
            h: 0.05,
        };
        assert!(in_tile(below, crop, 200.0, 400.0).is_none());
        let inside = Rect {
            x: 0.1,
            y: 0.1,
            w: 0.3,
            h: 0.05,
        };
        let b = in_tile(inside, crop, 200.0, 400.0).unwrap();
        assert!((b.y - (0.2 * 400.0 - 2.0)).abs() < 1e-3);
    }

    #[test]
    fn fit_keeps_the_aspect_and_centres() {
        let area = Bounds::new(point(px(0.), px(0.)), size(px(1000.), px(500.)));
        let r = fit(1.0, area, (4000.0, 4000.0));
        assert_eq!(r.size, size(px(500.), px(500.)));
        assert_eq!(r.origin.x, px(250.));
    }

    #[test]
    fn fit_never_blows_a_small_shot_up() {
        let area = Bounds::new(point(px(0.), px(0.)), size(px(1000.), px(500.)));
        let r = fit(586.0 / 134.0, area, (586.0, 134.0));
        let close = |a: Pixels, b: f32| (a.as_f32() - b).abs() < 0.01;
        assert!(
            close(r.size.width, 586.) && close(r.size.height, 134.),
            "{:?}",
            r.size
        );
        assert!(
            close(r.origin.x, 207.) && close(r.origin.y, 183.),
            "{:?}",
            r.origin
        );
    }
}
