//! Bursts: runs of near-identical screenshots, like six of the same chat
//! taken while scrolling, or one page shot twice. The grid shows one tile
//! per burst. Two shots belong together when they were taken close in time
//! and either look the same or say the same thing; a burst is everything
//! linked that way, one pair at a time.

use std::collections::HashMap;

use crate::Line;

/// Shots further apart than this are never the same burst, however alike.
/// Chained: a shot every five minutes for an hour is still one burst.
pub const WINDOW: i64 = 10 * 60;

/// What's compared between two shots.
pub struct Shape {
    pub width: u32,
    pub height: u32,
    /// A 64 bit difference hash of the thumbnail, see `look`. None until
    /// the reader has worked it out.
    pub look: Option<u64>,
    /// Each line worth comparing, normalised, with where it sits.
    lines: Vec<(String, f32)>,
}

// Shorter lines are mostly OCR crumbs ("x", "|", a lone digit) and stray
// icons, the same in every screenshot of anything.
const MIN_LINE: usize = 4;

impl Shape {
    pub fn new(width: u32, height: u32, look: Option<u64>, lines: &[Line]) -> Self {
        let lines = lines
            .iter()
            .filter_map(|l| {
                let key: String = l
                    .text
                    .chars()
                    .flat_map(char::to_lowercase)
                    .filter(|c| c.is_alphanumeric())
                    .collect();
                (key.chars().count() >= MIN_LINE).then_some((key, l.rect.y))
            })
            .collect();
        Self {
            width,
            height,
            look,
            lines,
        }
    }
}

/// How alike two shots are, measured, before deciding anything.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Likeness {
    /// Bits apart in `look`, 0 to 64. None if either isn't known yet.
    pub look: Option<u32>,
    /// Lines with something to compare, in the smaller and the larger.
    pub fewer: usize,
    pub more: usize,
    /// Lines the two have in common.
    pub shared: usize,
    /// Of those, how many sit at a different height in each, which is what
    /// scrolling does to a page. Lines that stay put are the app around it:
    /// a sidebar, a title bar, a tab strip.
    pub moved: usize,
    pub same_size: bool,
}

impl Likeness {
    pub fn of(a: &Shape, b: &Shape) -> Self {
        let look = a.look.zip(b.look).map(|(x, y)| (x ^ y).count_ones());
        let (small, large) = if a.lines.len() <= b.lines.len() {
            (a, b)
        } else {
            (b, a)
        };
        let mut shared = 0;
        let mut moved = 0;
        // Each line of the larger one is used once, so ten "Reply" buttons
        // in one don't all match the single one in the other.
        let mut used = vec![false; large.lines.len()];
        for (text, y) in &small.lines {
            let found = large
                .lines
                .iter()
                .enumerate()
                .find(|(i, (t, _))| !used[*i] && t == text);
            if let Some((i, (_, y2))) = found {
                used[i] = true;
                shared += 1;
                if (y - y2).abs() > MOVED {
                    moved += 1;
                }
            }
        }
        Self {
            look,
            fewer: small.lines.len(),
            more: large.lines.len(),
            shared,
            moved,
            same_size: a.width == b.width && a.height == b.height,
        }
    }

    /// The share of all the text that's in both, 0 to 1. Against the larger
    /// one, so a short shot whose few lines are a sidebar's doesn't count as
    /// the same as every other shot of that app.
    pub fn text(&self) -> f32 {
        if self.more == 0 {
            return 0.0;
        }
        self.shared as f32 / self.more as f32
    }
}

// A line that moved less than this (in heights of the image) stayed put.
const MOVED: f32 = 0.01;

/// Whether two shots taken `apart` seconds apart are the same burst.
///
/// Tuned on a real library of 6,863 screenshots, reading what each pair
/// said. Below these, pairs were mostly different pages of one app (two
/// tabs of a portal, a blog's posts and its about page), which share the
/// app around them and little else.
pub fn alike(l: &Likeness, apart: i64) -> bool {
    let text = l.text();
    // The same page twice, maybe a number changed: nearly every line is in
    // both.
    if l.more >= MIN_LINES && text >= SAME_TEXT {
        return true;
    }
    // Scrolled a little: most lines are still there, and they moved, so
    // it's the content that's shared and not only the app around it. Only
    // between shots of the same size taken in quick succession; a region
    // capture of another size moves every line anyway.
    if l.more >= MIN_LINES
        && text >= SCROLLED_TEXT
        && l.same_size
        && apart <= SCROLL_WINDOW
        && l.moved * 2 >= l.shared
    {
        return true;
    }
    // No text to speak of in either, a photo or a drawing: only the picture
    // can tell, and then it has to be nearly the same picture.
    l.more < MIN_LINES && l.same_size && l.look.is_some_and(|d| d <= SAME_LOOK)
}

// Fewer lines than this and text says too little about a shot to judge it.
const MIN_LINES: usize = 3;
const SAME_TEXT: f32 = 0.8;
const SCROLLED_TEXT: f32 = 0.6;
const SCROLL_WINDOW: i64 = 2 * 60;
const SAME_LOOK: u32 = 4;

/// The difference hash of an image already shrunk to 9x8 grey: one bit for
/// each pair of neighbours in a row, set where the left one is brighter.
/// Near-identical pictures land a few bits apart, different ones about 32.
pub fn look(grey: &[u8; 72]) -> u64 {
    let mut hash = 0u64;
    for row in 0..8 {
        for col in 0..8 {
            let i = row * 9 + col;
            hash = (hash << 1) | u64::from(grey[i] > grey[i + 1]);
        }
    }
    hash
}

/// Results stacked by burst, keeping their order: for each burst, the
/// place of its first result in `bursts`, then the places of the rest.
/// The first is the one shown, so it's the best match, or the newest when
/// browsing.
pub fn stack(bursts: &[i64]) -> Vec<(usize, Vec<usize>)> {
    let mut stacks: Vec<(usize, Vec<usize>)> = Vec::new();
    let mut at: HashMap<i64, usize> = HashMap::new();
    for (i, burst) in bursts.iter().enumerate() {
        match at.get(burst) {
            Some(&s) => stacks[s].1.push(i),
            None => {
                at.insert(*burst, stacks.len());
                stacks.push((i, Vec::new()));
            }
        }
    }
    stacks
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Rect;

    fn lines(texts: &[(&str, f32)]) -> Vec<Line> {
        texts
            .iter()
            .map(|(t, y)| Line {
                text: t.to_string(),
                rect: Rect {
                    x: 0.1,
                    y: *y,
                    w: 0.5,
                    h: 0.02,
                },
                score: 0.9,
            })
            .collect()
    }

    /// A chat window showing ten messages from `first` on, under a header
    /// that stays put.
    fn chat(first: usize) -> Vec<Line> {
        let msgs: Vec<String> = (first..first + 10)
            .map(|i| format!("message number {i} in the chat"))
            .collect();
        let mut out: Vec<(&str, f32)> = vec![("General chat", 0.02), ("Members online", 0.05)];
        for (k, m) in msgs.iter().enumerate() {
            out.push((m.as_str(), 0.1 + k as f32 * 0.08));
        }
        lines(&out)
    }

    #[test]
    fn the_same_page_twice_is_one_burst() {
        let a = Shape::new(800, 600, None, &chat(0));
        let b = Shape::new(812, 610, None, &chat(0));
        assert!(alike(&Likeness::of(&a, &b), 200));
    }

    #[test]
    fn a_chat_scrolled_a_little_is_one_burst() {
        // Four messages scrolled off the top, four new ones at the bottom.
        let a = Shape::new(800, 600, None, &chat(0));
        let b = Shape::new(800, 600, None, &chat(4));
        let l = Likeness::of(&a, &b);
        assert_eq!((l.shared, l.moved), (8, 6), "{l:?}");
        assert!(alike(&l, 5));
        // But not across a whole afternoon's worth of the window...
        assert!(!alike(&l, SCROLL_WINDOW + 1));
        // ...or between shots of different sizes, where every line moves.
        let c = Shape::new(700, 600, None, &chat(4));
        assert!(!alike(&Likeness::of(&a, &c), 5));
    }

    #[test]
    fn two_pages_of_one_app_are_not() {
        // Same sidebar, different content: the shared lines stay put.
        let side = [
            ("Inbox folder", 0.1),
            ("Sent folder", 0.2),
            ("Drafts folder", 0.3),
            ("Archive folder", 0.4),
        ];
        let mut a: Vec<(&str, f32)> = side.to_vec();
        a.extend([("Lunch on friday?", 0.15), ("See you there then", 0.25)]);
        let mut b: Vec<(&str, f32)> = side.to_vec();
        b.extend([("Your invoice is ready", 0.15), ("Amount due today", 0.25)]);
        let a = Shape::new(800, 600, None, &lines(&a));
        let b = Shape::new(800, 600, None, &lines(&b));
        assert!(!alike(&Likeness::of(&a, &b), 5));
    }

    #[test]
    fn pictures_without_text_need_nearly_the_same_look() {
        let a = Shape::new(640, 480, Some(0b1011_0110), &[]);
        let same = Shape::new(640, 480, Some(0b1011_0111), &[]);
        let other = Shape::new(640, 480, Some(!0b1011_0110), &[]);
        assert!(alike(&Likeness::of(&a, &same), 30));
        assert!(!alike(&Likeness::of(&a, &other), 30));
        // Unknown looks never match on looks alone.
        let unknown = Shape::new(640, 480, None, &[]);
        assert!(!alike(&Likeness::of(&a, &unknown), 30));
    }

    #[test]
    fn a_line_matches_once() {
        // Ten "Reply" buttons in one don't all match the single one in the
        // other.
        let many: Vec<(&str, f32)> = (0..10).map(|i| ("Reply here", i as f32 * 0.1)).collect();
        let a = Shape::new(800, 600, None, &lines(&many));
        let b = Shape::new(800, 600, None, &lines(&[("Reply here", 0.0)]));
        assert_eq!(Likeness::of(&a, &b).shared, 1);
    }

    #[test]
    fn crumbs_are_not_compared() {
        let a = Shape::new(
            10,
            10,
            None,
            &lines(&[("x", 0.1), ("12", 0.2), ("Real line", 0.3)]),
        );
        assert_eq!(a.lines.len(), 1);
    }

    #[test]
    fn look_sets_a_bit_where_the_left_is_brighter() {
        let mut grey = [0u8; 72];
        // Row 0 steps down, every other row is flat.
        for (col, v) in grey[..9].iter_mut().enumerate() {
            *v = 200 - col as u8 * 10;
        }
        assert_eq!(look(&grey), 0xff << 56);
    }

    #[test]
    fn stacks_keep_the_order_and_lead_with_the_first() {
        let s = stack(&[7, 3, 7, 9, 3, 7]);
        assert_eq!(s, vec![(0, vec![2, 5]), (1, vec![4]), (3, vec![])]);
    }
}
