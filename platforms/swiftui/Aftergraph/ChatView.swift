import SwiftUI

struct ChatView: View {
    @State private var draft = ""
    @State private var artifactOpen = false
    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 22) {
                    HStack { Spacer(); Text("Create a Q4 business report with key metrics, trends and recommendations.").padding(12).background(.quaternary, in: RoundedRectangle(cornerRadius: 14, style: .continuous)).frame(maxWidth: 320) }
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Friday").font(.subheadline.weight(.semibold))
                        Text("I turned that into structured work and started the analysis. I’ll only interrupt you if a decision or exception needs attention.").foregroundStyle(.secondary)
                        ForEach(Array(["Analyze data sources","Process Q4 metrics","Generate visualizations","Create recommendations","Compile final report"].enumerated()), id: \.offset) { index, step in
                            HStack { Image(systemName: index == 0 ? "checkmark.circle.fill" : index == 1 ? "circle.dotted" : "circle").foregroundStyle(index == 0 ? .green : index == 1 ? .blue : .secondary); Text(step); Spacer(); Text(index == 0 ? "Done" : index == 1 ? "Running" : "Pending").font(.caption).foregroundStyle(.secondary) }.padding(.vertical, 4)
                        }
                    }
                    Button { artifactOpen = true } label: { Label("Open Q4 Business Analysis", systemImage: "doc.text") }.buttonStyle(.bordered)
                }.padding(18)
            }
            HStack(spacing: 10) {
                Image(systemName: "paperclip").foregroundStyle(.secondary)
                TextField("Ask, create, analyze, or delegate…", text: $draft, axis: .vertical)
                Button { draft = "" } label: { Image(systemName: "arrow.up").frame(width: 32, height: 32) }.buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: 10))
            }.padding(10).background(.background).overlay(alignment: .top) { Divider() }
        }
        .navigationTitle("Build Q4 report")
        .sheet(isPresented: $artifactOpen) { NavigationStack { ArtifactView() } }
    }
}

struct ArtifactView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Q4 Business Analysis").font(.largeTitle.bold())
                Text("Performance review and strategic recommendations").foregroundStyle(.secondary)
                Text("Executive summary").font(.headline)
                Text("Q4 delivered strong results across key metrics, with revenue growth of 18% and customer acquisition increasing 24%. Retention held at 94%.")
                Grid(horizontalSpacing: 12, verticalSpacing: 12) {
                    GridRow { MetricView(value: "€4.2M", label: "Revenue"); MetricView(value: "12.8K", label: "Customers") }
                    GridRow { MetricView(value: "€326", label: "ARPU"); MetricView(value: "94%", label: "Retention") }
                }
            }.padding(24)
        }.navigationTitle("Artifact").navigationBarTitleDisplayMode(.inline)
    }
}

struct MetricView: View { let value: String; let label: String; var body: some View { VStack(alignment: .leading, spacing: 4) { Text(value).font(.title3.bold()); Text(label).font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading).padding().background(.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous)) } }
