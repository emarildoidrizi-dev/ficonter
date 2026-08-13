import Link from "next/link";
import styles from "./Brand.module.css";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      className={`brand ${styles.brand}`}
      href={href}
      aria-label="Ficonter homepage"
    >
      <img
        className={styles.mark}
        src="/ficonter-mark.svg"
        alt=""
        width={42}
        height={42}
        aria-hidden="true"
      />
      <span className={styles.wordmark}>Ficonter</span>
    </Link>
  );
}
