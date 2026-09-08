import type { FiconterLanguage } from "./config";
import { LANDING_UI_TRANSLATIONS } from "./landingUiCatalog";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;
type LandingTranslationRow = Record<NonEnglishLanguage, string>;

function landing(
  de: string,
  es: string,
  sq: string,
  ar: string,
  pt: string,
  it: string,
  ru: string,
): LandingTranslationRow {
  return { de, es, sq, ar, pt, it, ru };
}

/** Exact catalog for the rotating landing-page module showcase. */
export const LANDING_HERO_SHOWCASE_TRANSLATIONS: Record<string, LandingTranslationRow> = {
  "FICONTER workspace and module preview": landing("Vorschau der FICONTER-Arbeitsbereiche und Module", "Vista previa de espacios y módulos de FICONTER", "Pamje paraprake e hapësirave dhe moduleve FICONTER", "معاينة مساحات ووحدات FICONTER", "Pré-visualização dos espaços e módulos FICONTER", "Anteprima degli spazi e dei moduli FICONTER", "Предпросмотр пространств и модулей FICONTER"),
  "Show previous FICONTER module": landing("Vorheriges FICONTER-Modul anzeigen", "Mostrar el módulo anterior de FICONTER", "Shfaq modulin e mëparshëm FICONTER", "عرض وحدة FICONTER السابقة", "Mostrar o módulo FICONTER anterior", "Mostra il modulo FICONTER precedente", "Показать предыдущий модуль FICONTER"),
  "Show next FICONTER module": landing("Nächstes FICONTER-Modul anzeigen", "Mostrar el siguiente módulo de FICONTER", "Shfaq modulin tjetër FICONTER", "عرض وحدة FICONTER التالية", "Mostrar o módulo FICONTER seguinte", "Mostra il modulo FICONTER successivo", "Показать следующий модуль FICONTER"),
  "Illustrative preview": landing("Beispielvorschau", "Vista ilustrativa", "Pamje ilustruese", "معاينة توضيحية", "Pré-visualização ilustrativa", "Anteprima illustrativa", "Иллюстративный пример"),
  "Choose FICONTER module preview": landing("FICONTER-Modulvorschau auswählen", "Elegir vista previa del módulo FICONTER", "Zgjidh pamjen paraprake të modulit FICONTER", "اختر معاينة وحدة FICONTER", "Escolher pré-visualização do módulo FICONTER", "Scegli l’anteprima del modulo FICONTER", "Выбрать предпросмотр модуля FICONTER"),
  "Personal": landing("Privat", "Personal", "Personale", "شخصي", "Pessoal", "Personale", "Личное"),
  "Monthly planning": landing("Monatsplanung", "Planificación mensual", "Planifikimi mujor", "التخطيط الشهري", "Planeamento mensal", "Pianificazione mensile", "Ежемесячное планирование"),
  "Keep the month understandable after commitments, goals and reserves.": landing("Behalte den Monat auch nach Verpflichtungen, Zielen und Rücklagen verständlich im Blick.", "Mantén el mes claro después de compromisos, objetivos y reservas.", "Mbaje muajin të qartë edhe pas angazhimeve, objektivave dhe rezervave.", "حافظ على وضوح الشهر بعد الالتزامات والأهداف والاحتياطيات.", "Mantenha o mês claro depois de compromissos, objetivos e reservas.", "Mantieni il mese chiaro anche dopo impegni, obiettivi e riserve.", "Сохраняйте ясную картину месяца после обязательств, целей и резервов."),
  "Available": landing("Verfügbar", "Disponible", "Në dispozicion", "متاح", "Disponível", "Disponibile", "Доступно"),
  "Income": landing("Einnahmen", "Ingresos", "Të ardhurat", "الدخل", "Rendimentos", "Entrate", "Доходы"),
  "Committed": landing("Gebunden", "Comprometido", "Të angazhuara", "ملتزم به", "Comprometido", "Impegnato", "Обязательства"),
  "Reserve": landing("Rücklage", "Reserva", "Rezerva", "الاحتياطي", "Reserva", "Riserva", "Резерв"),
  "72% of this month’s plan is funded": landing("72 % des Monatsplans sind finanziert", "El 72 % del plan de este mes está financiado", "72% e planit të këtij muaji është e financuar", "تم تمويل 72٪ من خطة هذا الشهر", "72% do plano deste mês está financiado", "Il 72% del piano di questo mese è finanziato", "72% плана на этот месяц профинансировано"),
  "Business": landing("Geschäftlich", "Empresa", "Biznes", "الأعمال", "Empresa", "Business", "Бизнес"),
  "Business performance": landing("Geschäftsentwicklung", "Rendimiento empresarial", "Performanca e biznesit", "أداء الأعمال", "Desempenho empresarial", "Performance aziendale", "Показатели бизнеса"),
  "Separate operating figures from personal money while keeping both close at hand.": landing("Trenne Betriebszahlen von privaten Finanzen und behalte beides dennoch griffbereit.", "Separa las cifras operativas del dinero personal manteniendo ambos siempre accesibles.", "Ndaji shifrat operative nga paratë personale, duke i mbajtur të dyja lehtësisht të arritshme.", "افصل الأرقام التشغيلية عن الأموال الشخصية مع إبقاء كليهما في متناول اليد.", "Separe os números operacionais do dinheiro pessoal, mantendo ambos sempre acessíveis.", "Separa i dati operativi dal denaro personale mantenendo entrambi a portata di mano.", "Отделяйте операционные показатели от личных денег, сохраняя оба контекста под рукой."),
  "Revenue": landing("Umsatz", "Ingresos", "Të ardhurat", "الإيرادات", "Receitas", "Ricavi", "Выручка"),
  "Costs": landing("Kosten", "Costes", "Kostot", "التكاليف", "Custos", "Costi", "Расходы"),
  "Margin": landing("Marge", "Margen", "Marzhi", "الهامش", "Margem", "Margine", "Маржа"),
  "Revenue and operating costs in one focused view": landing("Umsatz und Betriebskosten in einer fokussierten Ansicht", "Ingresos y costes operativos en una vista enfocada", "Të ardhurat dhe kostot operative në një pamje të fokusuar", "الإيرادات وتكاليف التشغيل في عرض واحد مركز", "Receitas e custos operacionais numa vista focada", "Ricavi e costi operativi in una vista focalizzata", "Выручка и операционные расходы в одном сфокусированном представлении"),
  "Wealth": landing("Vermögen", "Patrimonio", "Pasuria", "الثروة", "Património", "Patrimonio", "Капитал"),
  "Goals & long-term progress": landing("Ziele & langfristiger Fortschritt", "Objetivos y progreso a largo plazo", "Objektivat & progresi afatgjatë", "الأهداف والتقدم طويل الأجل", "Objetivos e progresso a longo prazo", "Obiettivi e progresso a lungo termine", "Цели и долгосрочный прогресс"),
  "Follow reserves, goals and net-worth direction without losing sight of today.": landing("Verfolge Rücklagen, Ziele und die Entwicklung des Nettovermögens, ohne das Heute aus den Augen zu verlieren.", "Sigue las reservas, los objetivos y la evolución del patrimonio neto sin perder de vista el presente.", "Ndiq rezervat, objektivat dhe drejtimin e pasurisë neto pa humbur nga sytë të sotmen.", "تابع الاحتياطيات والأهداف واتجاه صافي الثروة دون أن تغفل عن الحاضر.", "Acompanhe reservas, objetivos e a evolução do património líquido sem perder de vista o presente.", "Segui riserve, obiettivi e direzione del patrimonio netto senza perdere di vista il presente.", "Следите за резервами, целями и динамикой капитала, не упуская из виду сегодняшний день."),
  "Net worth": landing("Nettovermögen", "Patrimonio neto", "Pasuria neto", "صافي الثروة", "Património líquido", "Patrimonio netto", "Чистый капитал"),
  "Goals": landing("Ziele", "Objetivos", "Objektivat", "الأهداف", "Objetivos", "Obiettivi", "Цели"),
  "12 months": landing("12 Monate", "12 meses", "12 muaj", "12 شهرًا", "12 meses", "12 mesi", "12 месяцев"),
  "Long-term progress stays connected to the monthly plan": landing("Langfristiger Fortschritt bleibt mit dem Monatsplan verbunden", "El progreso a largo plazo sigue conectado con el plan mensual", "Progresi afatgjatë mbetet i lidhur me planin mujor", "يبقى التقدم طويل الأجل مرتبطًا بالخطة الشهرية", "O progresso a longo prazo mantém-se ligado ao plano mensal", "Il progresso a lungo termine resta collegato al piano mensile", "Долгосрочный прогресс остаётся связан с месячным планом"),
  "Intelligence": landing("Intelligenz", "Inteligencia", "Inteligjenca", "الذكاء", "Inteligência", "Intelligenza", "Аналитика"),
  "Know what needs attention": landing("Erkenne, was Aufmerksamkeit braucht", "Sabe qué necesita atención", "Dije çfarë kërkon vëmendje", "اعرف ما يحتاج إلى اهتمام", "Saiba o que precisa de atenção", "Scopri cosa richiede attenzione", "Понимайте, что требует внимания"),
  "Turn financial activity into a short list of signals, priorities and next steps.": landing("Verwandle Finanzaktivitäten in eine kurze Liste aus Signalen, Prioritäten und nächsten Schritten.", "Convierte la actividad financiera en una lista breve de señales, prioridades y próximos pasos.", "Ktheje aktivitetin financiar në një listë të shkurtër sinjalesh, prioritetesh dhe hapash të ardhshëm.", "حوّل النشاط المالي إلى قائمة مختصرة من الإشارات والأولويات والخطوات التالية.", "Transforme a atividade financeira numa lista curta de sinais, prioridades e próximos passos.", "Trasforma l’attività finanziaria in un elenco breve di segnali, priorità e prossimi passi.", "Превращайте финансовую активность в короткий список сигналов, приоритетов и следующих шагов."),
  "Health": landing("Gesundheit", "Salud", "Shëndeti", "الصحة", "Saúde", "Salute", "Здоровье"),
  "Cash flow": landing("Cashflow", "Flujo de caja", "Rrjedha e parasë", "التدفق النقدي", "Fluxo de caixa", "Flusso di cassa", "Денежный поток"),
  "Opportunity": landing("Potenzial", "Oportunidad", "Mundësi", "فرصة", "Oportunidade", "Opportunità", "Возможность"),
  "Next bill": landing("Nächste Rechnung", "Próxima factura", "Fatura e radhës", "الفاتورة التالية", "Próxima conta", "Prossima fattura", "Следующий счёт"),
  "Focused insights without adding noise": landing("Fokussierte Erkenntnisse ohne unnötige Ablenkung", "Información enfocada sin añadir ruido", "Njohuri të fokusuara pa shtuar zhurmë", "رؤى مركزة من دون إضافة ضوضاء", "Informação focada sem acrescentar ruído", "Informazioni focalizzate senza aggiungere rumore", "Сфокусированные выводы без лишнего шума"),
  "Show Personal preview": landing("Privat-Vorschau anzeigen", "Mostrar vista Personal", "Shfaq pamjen Personale", "عرض المعاينة الشخصية", "Mostrar pré-visualização Pessoal", "Mostra anteprima Personale", "Показать личный предпросмотр"),
  "Show Business preview": landing("Geschäfts-Vorschau anzeigen", "Mostrar vista de Empresa", "Shfaq pamjen e Biznesit", "عرض معاينة الأعمال", "Mostrar pré-visualização de Empresa", "Mostra anteprima Business", "Показать предпросмотр бизнеса"),
  "Show Wealth preview": landing("Vermögens-Vorschau anzeigen", "Mostrar vista de Patrimonio", "Shfaq pamjen e Pasurisë", "عرض معاينة الثروة", "Mostrar pré-visualização de Património", "Mostra anteprima Patrimonio", "Показать предпросмотр капитала"),
  "Show Intelligence preview": landing("Intelligenz-Vorschau anzeigen", "Mostrar vista de Inteligencia", "Shfaq pamjen e Inteligjencës", "عرض معاينة الذكاء", "Mostrar pré-visualização de Inteligência", "Mostra anteprima Intelligenza", "Показать предпросмотр аналитики"),
};

Object.assign(LANDING_UI_TRANSLATIONS, LANDING_HERO_SHOWCASE_TRANSLATIONS);
