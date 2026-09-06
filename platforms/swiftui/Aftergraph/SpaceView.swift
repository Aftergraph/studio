import SwiftUI

struct SpaceView: View {
    @State private var zoom = "Mission"
    @State private var followAgent = false
    @State private var feedback = 0
    private let levels = ["Mission", "Workstream", "Task", "Agent", "Action", "Evidence"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Live work arranged around intent, context and attention.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Semantic zoom").font(.caption2.weight(.bold)).textCase(.uppercase).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(levels, id: \.self) { level in
                                    Button(level) { zoom = level; feedback += 1 }
                                        .buttonStyle(.borderedProminent)
                                        .tint(zoom == level ? .primary : .secondary.opacity(0.14))
                                }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("MISSION").font(.caption2).foregroundStyle(.secondary)
                                Text("Q4 Business Analysis").font(.headline)
                            }
                            Spacer()
                            Text("65%").monospacedDigit().foregroundStyle(.secondary)
                        }
                        ProgressView(value: 0.65)
                        Text("Analysis is live. Evidence remains attached as the workspace changes shape.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding(16)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Presence").font(.caption2.weight(.bold)).textCase(.uppercase).foregroundStyle(.secondary)
                        Label("Data Analysis Agent · running", systemImage: "bolt.fill")
                        Label("Research Agent · running", systemImage: "sparkles")
                        Label("Judge · idle", systemImage: "checkmark.shield")
                    }
                    Button(followAgent ? "Following agent" : "Follow agent") { followAgent.toggle(); feedback += 1 }
                        .buttonStyle(.borderedProminent)
                }
                .padding(20)
            }
            .navigationTitle("Space")
            .searchable(text: .constant(""), prompt: "Search Space")
            .sensoryFeedback(.selection, trigger: feedback)
        }
    }
}
