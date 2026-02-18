// app/page.jsx
import styles from './page.module.css'; // optional

async function getCards() {
  const res = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/cards.json`);
  if (!res.ok) return [];
  return res.json();
}

export default async function Home() {
  const cards = await getCards();

  return (
    <div className={styles.container}>
      {cards.map((card, index) => (
        <div key={index} className={`${styles.card} ${card.highlight ? styles.highlight : ''}`}>
          <div className={styles.icon}>{card.icon}</div>
          <h3>{card.title}</h3>
          <p>{card.description}</p>
          <div className={styles.features}>
            {card.features.map((f, i) => <span key={i}>{f}</span>)}
          </div>
          <a href={card.link} className={styles.button}>View Demo</a>
        </div>
      ))}
    </div>
  );
}
