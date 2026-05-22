import styles from './VisitProofPhotos.module.scss';

export function VisitProofPhotos({
  photos,
  title = 'Proof of service',
}: {
  photos: Array<{ id: string; public_url: string; created_at: string }>;
  title?: string;
}) {
  if (photos.length === 0) return null;

  return (
    <section className={styles.wrap}>
      <h3 className={styles.title}>{title}</h3>
      <ul className={styles.grid}>
        {photos.map((photo) => (
          <li key={photo.id}>
            <a href={photo.public_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.public_url} alt="" className={styles.photo} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
