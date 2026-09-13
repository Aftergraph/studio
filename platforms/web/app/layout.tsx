import './globals.css';

export const metadata = {
  title: 'Aftergraph Compose',
  description: 'Turn rough thoughts into clear, agent-ready instructions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
