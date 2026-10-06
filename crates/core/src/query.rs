//! What a search box holds: the words to look for, and filters on where
//! and when a screenshot was taken.
//!
//! A filter is `key:value` with one of four keys, `in`, `date`, `before`
//! and `after`. Anything else with a colon in it (`https://`, `12:30`,
//! `error:`) is just a word to search for. Bare words like `today` are
//! words too, since screenshots say "today" all the time.

use std::ops::Range;

use jiff::{Zoned, civil::Date, tz::TimeZone};

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Query {
    /// The words, as typed. Each has to appear in the shot.
    pub terms: Vec<String>,
    pub filters: Vec<Filter>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Filter {
    /// A folder anywhere on the shot's path whose name starts with this,
    /// ignoring case: `in:disc` for Discord.
    In(String),
    /// Taken at or after this many seconds since the epoch.
    Since(i64),
    /// Taken before this.
    Until(i64),
}

impl Query {
    pub fn parse(text: &str) -> Self {
        Self::parse_at(text, &Zoned::now())
    }

    /// Dates are worked out in the timezone of `now`, so `date:today`
    /// starts at local midnight.
    pub fn parse_at(text: &str, now: &Zoned) -> Self {
        let mut query = Self::default();
        for token in tokens(text) {
            match token.filter(now) {
                Parsed::Filters(filters) => query.filters.extend(filters),
                // Still being typed, `date:yes` on the way to `yesterday`.
                // Searching for it as text would empty the results for a
                // moment on every keystroke.
                Parsed::Unfinished => {}
                Parsed::Text => query.terms.push(token.text.to_string()),
            }
        }
        query
    }

    pub fn is_empty(&self) -> bool {
        self.terms.is_empty() && self.filters.is_empty()
    }
}

/// Where the filters sit in `text`, so the search box can set them apart
/// from the words. Only complete ones.
pub fn filter_spans(text: &str) -> Vec<Range<usize>> {
    let now = Zoned::now();
    tokens(text)
        .filter(|t| matches!(t.filter(&now), Parsed::Filters(_)))
        .map(|t| t.range)
        .collect()
}

struct Token<'a> {
    text: &'a str,
    range: Range<usize>,
}

enum Parsed {
    Filters(Vec<Filter>),
    Unfinished,
    Text,
}

impl Token<'_> {
    fn filter(&self, now: &Zoned) -> Parsed {
        let Some((key, value)) = self.text.split_once(':') else {
            return Parsed::Text;
        };
        let value = unquote(value);
        let key = key.to_ascii_lowercase();
        if !matches!(key.as_str(), "in" | "date" | "before" | "after") {
            return Parsed::Text;
        }
        if value.trim().is_empty() {
            return Parsed::Unfinished;
        }
        if key == "in" {
            return Parsed::Filters(vec![Filter::In(value.to_string())]);
        }
        let Some((from, to)) = span(value, now) else {
            return Parsed::Unfinished;
        };
        Parsed::Filters(match key.as_str() {
            "date" => vec![Filter::Since(from), Filter::Until(to)],
            "before" => vec![Filter::Until(from)],
            _ => vec![Filter::Since(from)],
        })
    }
}

/// Splits on whitespace, except inside a quoted filter value, so
/// `in:"my folder"` stays one token.
fn tokens(text: &str) -> impl Iterator<Item = Token<'_>> {
    let mut at = 0;
    std::iter::from_fn(move || {
        let rest = &text[at..];
        let start = at + (rest.len() - rest.trim_start().len());
        if start >= text.len() {
            return None;
        }
        let word = &text[start..];
        let mut end = start + word.find(char::is_whitespace).unwrap_or(word.len());
        if let Some(colon) = word.find(":\"")
            && start + colon < end
        {
            let open = start + colon + 2;
            let close = text[open..].find('"').map(|i| open + i + 1);
            end = close.unwrap_or(text.len()).max(end);
        }
        at = end;
        Some(Token {
            text: &text[start..end],
            range: start..end,
        })
    })
}

fn unquote(value: &str) -> &str {
    let value = value.strip_prefix('"').unwrap_or(value);
    value.strip_suffix('"').unwrap_or(value)
}

/// The stretch of time a date value covers, as `from..to` in seconds.
fn span(value: &str, now: &Zoned) -> Option<(i64, i64)> {
    let today = now.date();
    let value = value.to_ascii_lowercase();
    let (first, after) = match value.as_str() {
        "today" => (today, today.tomorrow().ok()?),
        "yesterday" => (today.yesterday().ok()?, today),
        // The last 7 and 30 days, today included.
        "week" => (
            today.checked_sub(jiff::Span::new().days(6)).ok()?,
            today.tomorrow().ok()?,
        ),
        "month" => (
            today.checked_sub(jiff::Span::new().days(29)).ok()?,
            today.tomorrow().ok()?,
        ),
        _ => {
            if let Some(month) = month_name(&value) {
                // The most recent one: in October, `aug` is this August,
                // `nov` is last November.
                let year = if month <= today.month() {
                    today.year()
                } else {
                    today.year() - 1
                };
                let first = Date::new(year, month, 1).ok()?;
                (first, first.last_of_month().tomorrow().ok()?)
            } else {
                iso(&value)?
            }
        }
    };
    let tz = now.time_zone();
    Some((midnight(first, tz)?, midnight(after, tz)?))
}

/// `2026`, `2026-08` or `2026-08-01`.
fn iso(value: &str) -> Option<(Date, Date)> {
    let parts: Vec<&str> = value.split('-').collect();
    let number = |s: &str, len: usize| (s.len() == len).then(|| s.parse::<i16>().ok()).flatten();
    match parts[..] {
        [y] => {
            let y = number(y, 4)?;
            Some((Date::new(y, 1, 1).ok()?, Date::new(y + 1, 1, 1).ok()?))
        }
        [y, m] => {
            let first = Date::new(number(y, 4)?, number(m, 2)? as i8, 1).ok()?;
            Some((first, first.last_of_month().tomorrow().ok()?))
        }
        [y, m, d] => {
            let day = Date::new(number(y, 4)?, number(m, 2)? as i8, number(d, 2)? as i8).ok()?;
            Some((day, day.tomorrow().ok()?))
        }
        _ => None,
    }
}

fn month_name(value: &str) -> Option<i8> {
    const MONTHS: [&str; 12] = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    ];
    // Three letters or more of a month's name, so `mar` and `march` both
    // work but `ma` isn't a guess between March and May.
    if value.len() < 3 {
        return None;
    }
    let ix = MONTHS.iter().position(|m| m.starts_with(value))?;
    Some(ix as i8 + 1)
}

fn midnight(date: Date, tz: &TimeZone) -> Option<i64> {
    Some(date.to_zoned(tz.clone()).ok()?.timestamp().as_second())
}

#[cfg(test)]
mod tests {
    use super::*;

    // A Tuesday afternoon in October, in UTC so the numbers are easy to check.
    // TimeZone::UTC rather than "[UTC]", which needs a time zone database
    // that minimal containers (CI's ubuntu:22.04) don't have.
    fn now() -> Zoned {
        jiff::civil::date(2026, 10, 6)
            .at(15, 30, 0, 0)
            .to_zoned(TimeZone::UTC)
            .unwrap()
    }

    fn at(date: &str) -> i64 {
        date.parse::<Date>()
            .unwrap()
            .to_zoned(TimeZone::UTC)
            .unwrap()
            .timestamp()
            .as_second()
    }

    fn parse(text: &str) -> Query {
        Query::parse_at(text, &now())
    }

    #[test]
    fn words_stay_words() {
        let q = parse("invoice  march https://x.com 12:30 error: today");
        assert_eq!(
            q.terms,
            [
                "invoice",
                "march",
                "https://x.com",
                "12:30",
                "error:",
                "today"
            ]
        );
        assert!(q.filters.is_empty());
    }

    #[test]
    fn folders_by_name_with_or_without_quotes() {
        let q = parse("otp in:disc IN:\"my shots\" code");
        assert_eq!(q.terms, ["otp", "code"]);
        assert_eq!(
            q.filters,
            [Filter::In("disc".into()), Filter::In("my shots".into())]
        );
    }

    #[test]
    fn days_relative_to_now() {
        assert_eq!(
            parse("date:today").filters,
            [
                Filter::Since(at("2026-10-06")),
                Filter::Until(at("2026-10-07"))
            ]
        );
        assert_eq!(
            parse("date:Yesterday").filters,
            [
                Filter::Since(at("2026-10-05")),
                Filter::Until(at("2026-10-06"))
            ]
        );
        assert_eq!(
            parse("date:week").filters,
            [
                Filter::Since(at("2026-09-30")),
                Filter::Until(at("2026-10-07"))
            ]
        );
        assert_eq!(
            parse("date:month").filters,
            [
                Filter::Since(at("2026-09-07")),
                Filter::Until(at("2026-10-07"))
            ]
        );
    }

    #[test]
    fn calendar_dates() {
        assert_eq!(
            parse("date:2026-08-01").filters,
            [
                Filter::Since(at("2026-08-01")),
                Filter::Until(at("2026-08-02"))
            ]
        );
        assert_eq!(
            parse("date:2026-02").filters,
            [
                Filter::Since(at("2026-02-01")),
                Filter::Until(at("2026-03-01"))
            ]
        );
        assert_eq!(
            parse("date:2025").filters,
            [
                Filter::Since(at("2025-01-01")),
                Filter::Until(at("2026-01-01"))
            ]
        );
        assert_eq!(
            parse("before:2026-08-01").filters,
            [Filter::Until(at("2026-08-01"))]
        );
        assert_eq!(
            parse("after:2026-08").filters,
            [Filter::Since(at("2026-08-01"))]
        );
    }

    #[test]
    fn month_names_mean_the_last_one() {
        assert_eq!(
            parse("date:aug").filters,
            [
                Filter::Since(at("2026-08-01")),
                Filter::Until(at("2026-09-01"))
            ]
        );
        // November hasn't happened yet this year.
        assert_eq!(
            parse("date:november").filters,
            [
                Filter::Since(at("2025-11-01")),
                Filter::Until(at("2025-12-01"))
            ]
        );
        assert_eq!(
            parse("before:oct").filters,
            [Filter::Until(at("2026-10-01"))]
        );
    }

    #[test]
    fn half_typed_filters_are_ignored_not_searched() {
        for text in [
            "date:",
            "date:yes",
            "in:",
            "before:2026-0",
            "date:ma",
            "after:\"",
        ] {
            let q = parse(text);
            assert!(q.is_empty(), "{text}: {q:?}");
        }
    }

    #[test]
    fn spans_cover_only_complete_filters() {
        let text = "otp in:\"my shots\" date:yes date:today";
        let spans: Vec<&str> = filter_spans(text).into_iter().map(|r| &text[r]).collect();
        assert_eq!(spans, ["in:\"my shots\"", "date:today"]);
    }

    #[test]
    fn an_unclosed_quote_runs_to_the_end() {
        assert_eq!(parse("in:\"my sh").filters, [Filter::In("my sh".into())]);
    }
}
