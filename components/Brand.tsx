import Link from "next/link";
import styles from "./Brand.module.css";

export function Brand({ href = "/", interactive = true }: { href?: string; interactive?: boolean }) {
  const content = (
    <>
      <img
        className={styles.mark}
        src="/ficonter-mark.svg"
        alt=""
        width={42}
        height={42}
        aria-hidden="true"
      />
      <span className={styles.identity}>
        <span className={styles.wordmark}>FICONTER</span>
        <span className={styles.descriptor}>Financial Control Center</span>
      </span>
    </>
  );

  if (!interactive) {
    return (
      <span className={`brand ${styles.brand}`} aria-label="FICONTER">
        {content}
      </span>
    );
  }

  return (
    <Link
      className={`brand ${styles.brand}`}
      href={href}
      aria-label="Ficonter homepage"
    >
      {content}
    </Link>
  );
}
