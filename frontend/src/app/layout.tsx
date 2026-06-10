// шаблон всего сайта
import './globals.css';

export const metadata = {
  title: 'DevBoard System',
  description: 'Kanban system built with Next.js 15',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="m-0 p-0">
        {children}
      </body>
    </html>
  );
}
