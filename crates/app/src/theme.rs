use gpui::{Global, Hsla, WindowAppearance, rgb, rgba};

/// The screenshots are the colour. Everything around them stays quiet, and
/// there is exactly one accent: shu, the vermilion of a hanko seal, used only
/// for text the search found.
#[derive(Clone, Copy)]
pub struct Theme {
    pub panel: Hsla,
    /// Behind a thumbnail while it loads.
    pub tile: Hsla,
    pub text: Hsla,
    pub muted: Hsla,
    pub faint: Hsla,
    pub hairline: Hsla,
    /// Laid over a thumbnail during a search so the found words can stay lit.
    pub veil: Hsla,
    pub accent: Hsla,
    pub accent_wash: Hsla,
    pub hover_wash: Hsla,
    pub keycap: Hsla,
}

impl Global for Theme {}

impl Theme {
    pub fn for_appearance(appearance: WindowAppearance) -> Self {
        match appearance {
            WindowAppearance::Dark | WindowAppearance::VibrantDark => Self::dark(),
            WindowAppearance::Light | WindowAppearance::VibrantLight => Self::light(),
        }
    }

    fn light() -> Self {
        Self {
            panel: rgb(0xf6f6f4).into(),
            tile: rgb(0xe7e6e2).into(),
            text: rgb(0x18181a).into(),
            muted: rgb(0x6d6c68).into(),
            faint: rgb(0xa9a7a1).into(),
            hairline: rgba(0x1818_1a14).into(),
            veil: rgba(0x1818_1a70).into(),
            accent: rgb(0xe0531f).into(),
            accent_wash: rgba(0xe053_1f2e).into(),
            hover_wash: rgba(0x1818_1a12).into(),
            keycap: rgb(0xebeae6).into(),
        }
    }

    fn dark() -> Self {
        Self {
            panel: rgb(0x141416).into(),
            tile: rgb(0x222226).into(),
            text: rgb(0xecebe7).into(),
            muted: rgb(0x9b9a95).into(),
            faint: rgb(0x5f5e5a).into(),
            hairline: rgba(0xffff_ff14).into(),
            veil: rgba(0x0000_0080).into(),
            accent: rgb(0xff7438).into(),
            accent_wash: rgba(0xff74_3833).into(),
            hover_wash: rgba(0xffff_ff14).into(),
            keycap: rgb(0x26262a).into(),
        }
    }
}
