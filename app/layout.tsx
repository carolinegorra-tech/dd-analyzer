import './globals.css';

export const metadata = {
  title: 'M&A Due Diligence',
  description: 'Document analysis & risk identification',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
