import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack { ChatView() }
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
            NavigationStack { WorkView() }
                .tabItem { Label("Work", systemImage: "briefcase") }
            NavigationStack { SpaceView() }
                .tabItem { Label("Space", systemImage: "rectangle.split.3x1") }
        }
        .tint(.primary)
    }
}
