// app/page.jsx
import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'PackCDN Demos',
  description: 'Explore immersive WebGL games, 3D graphics, and interactive React components.',
};

async function getCards() {
  try {
    // Use relative URL – Next.js server component fetch resolves correctly
    const res = await fetch('/cards.json', {
      next: { revalidate: 60 }, // optional: revalidate every 60 seconds
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error('Failed to fetch cards:', error);
    return [];
  }
}

export default async function Home() {
  const cards = await getCards();

  if (cards.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No demos available.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {cards.map((card, index) => {
        const isInternal = card.link.startsWith('/');
        const LinkComponent = isInternal ? Link : 'a';
        const linkProps = isInternal
          ? { href: card.link }
          : { href: card.link, target: '_blank', rel: 'noopener noreferrer' };

        return (
          <div key={index} className={`${styles.card} ${card.highlight ? styles.highlight : ''}`}>
            <div className={styles.icon}>{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <div className={styles.features}>
              {card.features.map((f, i) => (
                <span key={i}>{f}</span>
              ))}
            </div>
            <LinkComponent className={styles.button} {...linkProps}>
              View Demo
            </LinkComponent>
          </div>
        );
      })}
    </div>
  );
}
