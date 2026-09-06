import SwiftUI

enum MotionSemantic: String, CaseIterable {
    case controlPress
    case stateChange
    case trajectoryAdvance
    case surfaceExpand
    case attentionFocus
    case outcomeSettle

    var animation: Animation {
        switch self {
        case .controlPress:
            return .spring(response: 0.18, dampingFraction: 0.88)
        case .stateChange:
            return .spring(response: 0.24, dampingFraction: 0.86)
        case .trajectoryAdvance:
            return .spring(response: 0.28, dampingFraction: 0.84)
        case .surfaceExpand:
            return .spring(response: 0.34, dampingFraction: 0.86)
        case .attentionFocus:
            return .spring(response: 0.36, dampingFraction: 0.88)
        case .outcomeSettle:
            return .spring(response: 0.42, dampingFraction: 0.90)
        }
    }
}

struct LivingSurfaceModifier: ViewModifier {
    let semantic: MotionSemantic
    let active: Bool
    func body(content: Content) -> some View {
        content
            .animation(semantic.animation, value: active)
            .contentTransition(.opacity)
    }
}

extension View {
    func livingMotion(_ semantic: MotionSemantic, active: Bool) -> some View {
        modifier(LivingSurfaceModifier(semantic: semantic, active: active))
    }
}
