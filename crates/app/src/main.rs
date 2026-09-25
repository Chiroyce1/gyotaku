use gpui::{
    App, Bounds, Context, SharedString, TitlebarOptions, Window, WindowBounds, WindowOptions, div,
    prelude::*, px, rgb, size,
};
use gpui_platform::application;
use gyotaku_core::Index;

struct Search {
    placeholder: SharedString,
}

impl Render for Search {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .size_full()
            .flex()
            .flex_col()
            .bg(rgb(0xf4f3ef))
            .p_6()
            .child(
                div()
                    .text_2xl()
                    .text_color(rgb(0x8a877f))
                    .child(self.placeholder.clone()),
            )
    }
}

fn main() -> anyhow::Result<()> {
    let shots = Index::open_default()?.len()?;
    let placeholder = match shots {
        0 => "nothing indexed yet".into(),
        1 => "search 1 screenshot".into(),
        n => format!("search {n} screenshots").into(),
    };

    application().run(move |cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(760.), px(520.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                titlebar: Some(TitlebarOptions {
                    title: Some("gyotaku".into()),
                    ..Default::default()
                }),
                // What niri window rules and launchers match on.
                app_id: Some("gyotaku".into()),
                ..Default::default()
            },
            |_, cx| cx.new(|_| Search { placeholder }),
        )
        .unwrap();
        cx.activate(true);
    });
    Ok(())
}
