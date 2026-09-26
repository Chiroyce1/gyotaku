//! gpui only animates with a fixed duration and an easing curve, which can't
//! be interrupted: reverse one halfway and it snaps. A spring keeps its
//! velocity when the target moves, so opening a screenshot and hitting escape
//! mid flight turns around smoothly from wherever it is.

use std::f32::consts::TAU;

#[derive(Clone, Copy, Debug)]
pub struct Spring {
    pub value: f32,
    velocity: f32,
    target: f32,
    stiffness: f32,
    damping: f32,
}

// Integrating in small fixed steps keeps it stable when a frame comes late.
const STEP: f32 = 1.0 / 240.0;

impl Spring {
    /// `response` is roughly how long it takes to get there, in seconds.
    /// `damping_ratio` 1.0 arrives without overshooting, lower bounces.
    pub fn new(value: f32, response: f32, damping_ratio: f32) -> Self {
        let omega = TAU / response;
        Self {
            value,
            velocity: 0.0,
            target: value,
            stiffness: omega * omega,
            damping: 2.0 * damping_ratio * omega,
        }
    }

    pub fn target(&self) -> f32 {
        self.target
    }

    /// Only the target moves. Position and velocity carry on, which is the
    /// whole point.
    pub fn set_target(&mut self, target: f32) {
        self.target = target;
    }

    pub fn step(&mut self, dt: f32) {
        let mut left = dt.min(0.1);
        while left > 0.0 {
            let h = left.min(STEP);
            let force = -self.stiffness * (self.value - self.target) - self.damping * self.velocity;
            self.velocity += force * h;
            self.value += self.velocity * h;
            left -= h;
        }
        if self.is_settled() {
            self.value = self.target;
            self.velocity = 0.0;
        }
    }

    pub fn is_settled(&self) -> bool {
        (self.value - self.target).abs() < 1e-3 && self.velocity.abs() < 1e-2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(s: &mut Spring, secs: f32) -> Vec<f32> {
        let mut seen = Vec::new();
        let mut t = 0.0;
        while t < secs {
            s.step(1.0 / 60.0);
            seen.push(s.value);
            t += 1.0 / 60.0;
        }
        seen
    }

    #[test]
    fn gets_there_and_stops() {
        let mut s = Spring::new(0.0, 0.35, 1.0);
        s.set_target(1.0);
        run(&mut s, 1.0);
        assert!(s.is_settled());
        assert_eq!(s.value, 1.0);
    }

    #[test]
    fn critically_damped_never_overshoots() {
        let mut s = Spring::new(0.0, 0.35, 1.0);
        s.set_target(1.0);
        assert!(run(&mut s, 1.0).iter().all(|&v| v <= 1.0 + 1e-4));
    }

    #[test]
    fn most_of_the_way_there_within_the_response_time() {
        let mut s = Spring::new(0.0, 0.35, 1.0);
        s.set_target(1.0);
        run(&mut s, 0.35);
        assert!(s.value > 0.9, "{}", s.value);
    }

    #[test]
    fn turning_around_mid_flight_is_continuous() {
        let mut s = Spring::new(0.0, 0.35, 1.0);
        s.set_target(1.0);
        run(&mut s, 0.1);
        let before = s.value;
        s.set_target(0.0);
        s.step(1.0 / 60.0);
        // no jump back to where it started, it keeps drifting forward first
        assert!(s.value >= before - 0.02, "{before} -> {}", s.value);
        run(&mut s, 1.0);
        assert_eq!(s.value, 0.0);
    }

    #[test]
    fn a_huge_frame_gap_does_not_explode() {
        let mut s = Spring::new(0.0, 0.2, 1.0);
        s.set_target(1.0);
        s.step(5.0);
        assert!(s.value.is_finite() && s.value <= 1.0 + 1e-3);
    }
}
