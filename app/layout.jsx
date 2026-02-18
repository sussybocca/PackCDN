export const metadata = {
  title: 'PackCDN',
  description: 'Custom CDN for interactive experiences',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
