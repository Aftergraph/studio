import SwiftUI
struct LibraryView: View {
    @State private var selected: String?
    let artifacts = ["q4_report_draft.md", "revenue_chart.svg", "market_analysis.json", "release-evidence.json"]
    var body: some View {
        List(artifacts, id: \.self) { artifact in
            Button { selected = artifact } label: { HStack { Image(systemName: "doc.text"); Text(artifact); Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary) } }.buttonStyle(.plain)
        }
        .navigationTitle("Library")
        .sheet(item: Binding(get: { selected.map(ArtifactSelection.init) }, set: { selected = $0?.name })) { _ in NavigationStack { ArtifactView() } }
    }
}
struct ArtifactSelection: Identifiable { let name: String; var id: String { name } }
