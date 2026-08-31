import { LegalPageShell, legalStyles } from "@/components/LegalPageShell";

export default function CookiesPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Cookies & Local Storage Notice">
      <section className={legalStyles.section}>
        <h2>1. Why browser storage is used</h2>
        <p>FICONTER may use cookies, local storage and similar browser technologies where necessary to keep users signed in securely, remember requested interface preferences, maintain workspace state, protect sessions and provide features expressly requested by the user.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>2. Strictly necessary technologies</h2>
        <p>Technologies that are strictly necessary to provide a service requested by the user do not require consent under the applicable German device-privacy rules. FICONTER should limit non-consensual browser storage to this necessary category.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>3. Optional technologies</h2>
        <p>If FICONTER later introduces analytics, advertising, profiling or other non-essential technologies that require consent, they must not activate before valid consent is obtained. Users must be able to refuse or withdraw that consent as easily as they gave it.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>4. Current preference storage</h2>
        <p>FICONTER may store interface preferences such as appearance, density, selected workspace or base-currency presentation locally in the browser so the requested experience can be restored without unnecessary delay. Authentication providers may also use secure cookies required for session management.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>5. Browser controls</h2>
        <p>You can remove browser storage through your browser settings. Removing necessary session or preference storage may sign you out, reset preferences or temporarily affect requested functionality.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>6. Changes</h2>
        <p>This notice will be updated if FICONTER introduces additional browser technologies or changes the purposes for which they are used.</p>
      </section>
    </LegalPageShell>
  );
}
