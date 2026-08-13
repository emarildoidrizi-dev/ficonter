import type { FiconterLanguage } from "./config";
import { PHRASE_TRANSLATIONS, translatePhrase } from "./phrases";
import { FULL_UI_TRANSLATIONS } from "./fullUiCatalog";
import { WEALTH_UI_TRANSLATIONS } from "./wealthUiCatalog";
import { translateWealthTemplate } from "./wealthRuntimeTemplates";
import { translateGlobalTemplate } from "./globalRuntimeTemplates";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;
type TranslationRow = Record<NonEnglishLanguage, string>;

function row(
  de: string,
  es: string,
  sq: string,
  ar: string,
  pt: string,
  it: string,
  ru: string,
): TranslationRow {
  return { de, es, sq, ar, pt, it, ru };
}

/**
 * Small glue catalog for runtime-generated UI text.
 * The main product translations remain in phrases.ts. These entries cover
 * common dynamic fragments that are frequently combined with numbers,
 * dates, percentages or live financial values.
 */
const RUNTIME_TRANSLATIONS: Record<string, TranslationRow> = {
  "Current plan": row("Aktueller Tarif", "Plan actual", "Plani aktual", "الخطة الحالية", "Plano atual", "Piano attuale", "Текущий тариф"),
  "Free plan": row("Kostenloser Tarif", "Plan gratuito", "Plani falas", "الخطة المجانية", "Plano gratuito", "Piano gratuito", "Бесплатный тариф"),
  "Recommended": row("Empfohlen", "Recomendado", "Rekomanduar", "موصى به", "Recomendado", "Consigliato", "Рекомендуется"),
  "Plan": row("Tarif", "Plan", "Plan", "الخطة", "Plano", "Piano", "Тариф"),
  "Billing": row("Abrechnung", "Facturación", "Faturimi", "الفوترة", "Faturação", "Fatturazione", "Оплата"),
  "Invoices": row("Rechnungen", "Facturas", "Faturat", "الفواتير", "Faturas", "Fatture", "Счета"),
  "Beta access": row("Beta-Zugang", "Acceso Beta", "Qasja Beta", "وصول بيتا", "Acesso Beta", "Accesso Beta", "Бета-доступ"),
  "Active": row("Aktiv", "Activo", "Aktiv", "نشط", "Ativo", "Attivo", "Активно"),
  "Inactive": row("Inaktiv", "Inactivo", "Joaktiv", "غير نشط", "Inativo", "Inattivo", "Неактивно"),
  "Paid": row("Bezahlt", "Pagado", "Paguar", "مدفوع", "Pago", "Pagato", "Оплачено"),
  "Unpaid": row("Unbezahlt", "No pagado", "Papaguar", "غير مدفوع", "Não pago", "Non pagato", "Не оплачено"),
  "Past due": row("Überfällig", "Vencido", "Me vonesë", "متأخر", "Em atraso", "Scaduto", "Просрочено"),
  "Canceled": row("Gekündigt", "Cancelado", "Anuluar", "ملغى", "Cancelado", "Annullato", "Отменено"),
  "Trialing": row("Testphase", "En prueba", "Në provë", "فترة تجريبية", "Em teste", "In prova", "Пробный период"),
  "Available": row("Verfügbar", "Disponible", "Në dispozicion", "متاح", "Disponível", "Disponibile", "Доступно"),
  "Remaining": row("Verbleibend", "Restante", "Mbetur", "المتبقي", "Restante", "Rimanente", "Осталось"),
  "Recorded": row("Erfasst", "Registrado", "Regjistruar", "مسجل", "Registado", "Registrato", "Записано"),
  "Complete": row("Abschließen", "Completar", "Përfundo", "إكمال", "Concluir", "Completa", "Завершить"),
  "Completed": row("Abgeschlossen", "Completado", "Përfunduar", "مكتمل", "Concluído", "Completato", "Завершено"),
  "Progress": row("Fortschritt", "Progreso", "Progresi", "التقدم", "Progresso", "Progresso", "Прогресс"),
  "Total": row("Gesamt", "Total", "Totali", "الإجمالي", "Total", "Totale", "Итого"),
  "Minimum": row("Minimum", "Mínimo", "Minimumi", "الحد الأدنى", "Mínimo", "Minimo", "Минимум"),
  "Maximum": row("Maximum", "Máximo", "Maksimumi", "الحد الأقصى", "Máximo", "Massimo", "Максимум"),
  "Average": row("Durchschnitt", "Promedio", "Mesatarja", "المتوسط", "Média", "Media", "Среднее"),
  "Balance": row("Saldo", "Saldo", "Bilanci", "الرصيد", "Saldo", "Saldo", "Баланс"),
  "Current balance": row("Aktueller Saldo", "Saldo actual", "Bilanci aktual", "الرصيد الحالي", "Saldo atual", "Saldo attuale", "Текущий баланс"),
  "Statement balance": row("Abrechnungssaldo", "Saldo del extracto", "Bilanci i deklaratës", "رصيد كشف الحساب", "Saldo do extrato", "Saldo dell'estratto", "Баланс выписки"),
  "Credit limit": row("Kreditlimit", "Límite de crédito", "Limiti i kredisë", "حد الائتمان", "Limite de crédito", "Limite di credito", "Кредитный лимит"),
  "Available credit": row("Verfügbarer Kredit", "Crédito disponible", "Kredia e disponueshme", "الائتمان المتاح", "Crédito disponível", "Credito disponibile", "Доступный кредит"),
  "Minimum payment": row("Mindestzahlung", "Pago mínimo", "Pagesa minimale", "الحد الأدنى للدفع", "Pagamento mínimo", "Pagamento minimo", "Минимальный платёж"),
  "Interest charged": row("Berechnete Zinsen", "Intereses cobrados", "Interesi i ngarkuar", "الفائدة المحتسبة", "Juros cobrados", "Interessi addebitati", "Начисленные проценты"),
  "Due date": row("Fälligkeitsdatum", "Fecha de vencimiento", "Data e afatit", "تاريخ الاستحقاق", "Data de vencimento", "Data di scadenza", "Срок оплаты"),
  "Payment": row("Zahlung", "Pago", "Pagesa", "الدفعة", "Pagamento", "Pagamento", "Платёж"),
  "Payments": row("Zahlungen", "Pagos", "Pagesat", "الدفعات", "Pagamentos", "Pagamenti", "Платежи"),
  "today": row("heute", "hoy", "sot", "اليوم", "hoje", "oggi", "сегодня"),
  "Today": row("Heute", "Hoy", "Sot", "اليوم", "Hoje", "Oggi", "Сегодня"),
  "tomorrow": row("morgen", "mañana", "nesër", "غدًا", "amanhã", "domani", "завтра"),
  "Tomorrow": row("Morgen", "Mañana", "Nesër", "غدًا", "Amanhã", "Domani", "Завтра"),
  "yesterday": row("gestern", "ayer", "dje", "أمس", "ontem", "ieri", "вчера"),
  "This week": row("Diese Woche", "Esta semana", "Këtë javë", "هذا الأسبوع", "Esta semana", "Questa settimana", "На этой неделе"),
  "This month": row("Dieser Monat", "Este mes", "Këtë muaj", "هذا الشهر", "Este mês", "Questo mese", "В этом месяце"),
  "Next month": row("Nächster Monat", "Próximo mes", "Muaji tjetër", "الشهر القادم", "Próximo mês", "Mese prossimo", "Следующий месяц"),
  "Last month": row("Letzter Monat", "Mes pasado", "Muaji i kaluar", "الشهر الماضي", "Mês passado", "Mese scorso", "Прошлый месяц"),
  "per month": row("pro Monat", "al mes", "në muaj", "شهريًا", "por mês", "al mese", "в месяц"),
  "per year": row("pro Jahr", "al año", "në vit", "سنويًا", "por ano", "all'anno", "в год"),
  "Monthly": row("Monatlich", "Mensual", "Mujore", "شهري", "Mensal", "Mensile", "Ежемесячно"),
  "Annual": row("Jährlich", "Anual", "Vjetore", "سنوي", "Anual", "Annuale", "Ежегодно"),
  "day": row("Tag", "día", "ditë", "يوم", "dia", "giorno", "день"),
  "days": row("Tage", "días", "ditë", "أيام", "dias", "giorni", "дней"),
  "week": row("Woche", "semana", "javë", "أسبوع", "semana", "settimana", "неделя"),
  "weeks": row("Wochen", "semanas", "javë", "أسابيع", "semanas", "settimane", "недель"),
  "month": row("Monat", "mes", "muaj", "شهر", "mês", "mese", "месяц"),
  "months": row("Monate", "meses", "muaj", "أشهر", "meses", "mesi", "месяцев"),
  "year": row("Jahr", "año", "vit", "سنة", "ano", "anno", "год"),
  "years": row("Jahre", "años", "vite", "سنوات", "anos", "anni", "лет"),
  "remaining": row("verbleibend", "restantes", "të mbetura", "متبقية", "restantes", "rimanenti", "осталось"),
  "left": row("übrig", "restantes", "mbetur", "متبقي", "restantes", "rimasti", "осталось"),
  "due": row("fällig", "vence", "afat", "مستحق", "vence", "in scadenza", "к оплате"),
  "of": row("von", "de", "nga", "من", "de", "di", "из"),
  "in": row("in", "en", "në", "خلال", "em", "tra", "через"),
};


// V31: exact full-phrase translations for the Horizon overview and
// Financial GPS surfaces. These are intentionally sentence-level: never
// create half-English / half-translated financial guidance.
Object.assign(RUNTIME_TRANSLATIONS, {
  "Credit Cards": row(
    "Kreditkarten",
    "Tarjetas de crédito",
    "Kartat e kreditit",
    "بطاقات الائتمان",
    "Cartões de crédito",
    "Carte di credito",
    "Кредитные карты"
  ),
  "Live": row(
    "Live",
    "En vivo",
    "Drejtpërdrejt",
    "مباشر",
    "Ao vivo",
    "In diretta",
    "В реальном времени"
  ),
  "Now": row(
    "Jetzt",
    "Ahora",
    "Tani",
    "الآن",
    "Agora",
    "Ora",
    "Сейчас"
  ),
  "Next priority": row(
    "Nächste Priorität",
    "Próxima prioridad",
    "Prioriteti i radhës",
    "الأولوية التالية",
    "Próxima prioridade",
    "Prossima priorità",
    "Следующий приоритет"
  ),
  "Risk": row(
    "Risiko",
    "Riesgo",
    "Rreziku",
    "المخاطر",
    "Risco",
    "Rischio",
    "Риск"
  ),
  "Navigate": row(
    "Navigieren",
    "Navegar",
    "Navigo",
    "تنقّل",
    "Navegar",
    "Naviga",
    "Навигация"
  ),
  "Financial command strip": row(
    "Finanzielle Befehlsleiste",
    "Barra de comandos financieros",
    "Shiriti i komandave financiare",
    "شريط الأوامر المالية",
    "Barra de comandos financeiros",
    "Barra dei comandi finanziari",
    "Панель финансовых команд"
  ),
  "Horizon financial overview": row(
    "Horizon-Finanzübersicht",
    "Resumen financiero Horizon",
    "Përmbledhja financiare Horizon",
    "نظرة Horizon المالية",
    "Visão financeira Horizon",
    "Panoramica finanziaria Horizon",
    "Финансовый обзор Horizon"
  ),
  "Baseline pending": row(
    "Ausgangsbasis ausstehend",
    "Línea base pendiente",
    "Baza fillestare në pritje",
    "خط الأساس قيد الانتظار",
    "Base pendente",
    "Base iniziale in attesa",
    "Базовые данные ожидаются"
  ),
  "Add income and an outflow": row(
    "Einnahmen und eine Ausgabe hinzufügen",
    "Añade un ingreso y un gasto",
    "Shto të ardhura dhe një dalje",
    "أضف دخلاً ومصروفًا",
    "Adicione um rendimento e uma despesa",
    "Aggiungi un'entrata e un'uscita",
    "Добавьте доход и расход"
  ),
  "Cash flow balanced": row(
    "Cashflow ausgeglichen",
    "Flujo de caja equilibrado",
    "Rrjedha e parasë e balancuar",
    "التدفق النقدي متوازن",
    "Fluxo de caixa equilibrado",
    "Flusso di cassa in equilibrio",
    "Денежный поток сбалансирован"
  ),
  "Confidence developing": row(
    "Aussagekraft im Aufbau",
    "Confianza en desarrollo",
    "Besueshmëria po zhvillohet",
    "الثقة قيد التطور",
    "Confiança em desenvolvimento",
    "Affidabilità in sviluppo",
    "Надёжность оценки растёт"
  ),
  "Developing confidence": row(
    "Aussagekraft im Aufbau",
    "Confianza en desarrollo",
    "Besueshmëria po zhvillohet",
    "الثقة قيد التطور",
    "Confiança em desenvolvimento",
    "Affidabilità in sviluppo",
    "Надёжность оценки растёт"
  ),
  "Continue the current plan": row(
    "Aktuellen Plan fortsetzen",
    "Continuar con el plan actual",
    "Vazhdo planin aktual",
    "واصل الخطة الحالية",
    "Continuar o plano atual",
    "Continua con il piano attuale",
    "Продолжить текущий план"
  ),
  "Positive": row(
    "Positiv",
    "Positivo",
    "Pozitiv",
    "إيجابي",
    "Positivo",
    "Positivo",
    "Положительно"
  ),
  "Needs attention": row(
    "Aufmerksamkeit erforderlich",
    "Requiere atención",
    "Kërkon vëmendje",
    "يحتاج إلى اهتمام",
    "Requer atenção",
    "Richiede attenzione",
    "Требует внимания"
  ),
  "Income minus all completed outflows recorded to date.": row(
    "Einnahmen abzüglich aller bis heute erfassten, abgeschlossenen Ausgaben.",
    "Ingresos menos todos los gastos completados registrados hasta la fecha.",
    "Të ardhurat minus të gjitha daljet e përfunduara të regjistruara deri më sot.",
    "الدخل مطروحًا منه جميع المصروفات المكتملة والمسجلة حتى اليوم.",
    "Rendimentos menos todas as despesas concluídas registadas até à data.",
    "Entrate meno tutte le uscite completate registrate fino a oggi.",
    "Доходы за вычетом всех завершённых расходов, зарегистрированных на текущую дату."
  ),
  "Recorded income": row(
    "Erfasste Einnahmen",
    "Ingresos registrados",
    "Të ardhura të regjistruara",
    "الدخل المسجل",
    "Rendimentos registados",
    "Entrate registrate",
    "Зарегистрированные доходы"
  ),
  "Recorded expenses": row(
    "Erfasste Ausgaben",
    "Gastos registrados",
    "Shpenzime të regjistruara",
    "المصروفات المسجلة",
    "Despesas registadas",
    "Spese registrate",
    "Зарегистрированные расходы"
  ),
  "Income allocation": row(
    "Einkommensverteilung",
    "Distribución de ingresos",
    "Shpërndarja e të ardhurave",
    "توزيع الدخل",
    "Distribuição do rendimento",
    "Allocazione del reddito",
    "Распределение дохода"
  ),
  "Total savings": row(
    "Gesamte Ersparnisse",
    "Ahorros totales",
    "Kursimet totale",
    "إجمالي المدخرات",
    "Poupanças totais",
    "Risparmi totali",
    "Общие сбережения"
  ),
  "Remaining cash flow": row(
    "Verbleibender Cashflow",
    "Flujo de caja restante",
    "Rrjedha e mbetur e parasë",
    "التدفق النقدي المتبقي",
    "Fluxo de caixa restante",
    "Flusso di cassa rimanente",
    "Оставшийся денежный поток"
  ),
  "These values use the same Wealth Engine totals shown across FICONTER.": row(
    "Diese Werte verwenden dieselben Wealth-Engine-Gesamtsummen, die überall in FICONTER angezeigt werden.",
    "Estos valores utilizan los mismos totales de Wealth Engine que se muestran en FICONTER.",
    "Këto vlera përdorin të njëjtat totale të Wealth Engine që shfaqen në FICONTER.",
    "تستخدم هذه القيم إجماليات Wealth Engine نفسها المعروضة في FICONTER.",
    "Estes valores usam os mesmos totais do Wealth Engine apresentados em todo o FICONTER.",
    "Questi valori utilizzano gli stessi totali del Wealth Engine mostrati in FICONTER.",
    "Эти значения используют те же итоговые показатели Wealth Engine, которые отображаются во всём FICONTER."
  ),
  "Why this is the priority": row(
    "Warum dies die Priorität ist",
    "Por qué esta es la prioridad",
    "Pse ky është prioriteti",
    "لماذا هذه هي الأولوية",
    "Porque esta é a prioridade",
    "Perché questa è la priorità",
    "Почему это приоритет"
  ),
  "Open Financial GPS": row(
    "Finanz-GPS öffnen",
    "Abrir GPS financiero",
    "Hap GPS financiar",
    "فتح نظام التوجيه المالي",
    "Abrir GPS financeiro",
    "Apri GPS finanziario",
    "Открыть Финансовый GPS"
  ),
  "Completed financial activity through today, normalized in euros. Scheduled entries remain visible but are excluded until their date.": row(
    "Abgeschlossene Finanzaktivitäten bis heute, in Euro vereinheitlicht. Geplante Einträge bleiben sichtbar, werden jedoch bis zu ihrem Datum nicht einbezogen.",
    "Actividad financiera completada hasta hoy, normalizada en euros. Las entradas programadas siguen visibles, pero se excluyen hasta su fecha.",
    "Aktiviteti financiar i përfunduar deri më sot, i normalizuar në euro. Regjistrimet e planifikuara mbeten të dukshme, por përjashtohen deri në datën e tyre.",
    "النشاط المالي المكتمل حتى اليوم، موحّد باليورو. تظل الإدخالات المجدولة ظاهرة، لكنها لا تُحتسب حتى تاريخها.",
    "Atividade financeira concluída até hoje, normalizada em euros. As entradas agendadas permanecem visíveis, mas são excluídas até à respetiva data.",
    "Attività finanziaria completata fino a oggi, normalizzata in euro. Le voci programmate restano visibili, ma sono escluse fino alla loro data.",
    "Завершённая финансовая активность по текущую дату, приведённая к евро. Запланированные записи остаются видимыми, но не учитываются до наступления их даты."
  ),
  "Income recorded": row(
    "Erfasste Einnahmen",
    "Ingresos registrados",
    "Të ardhurat e regjistruara",
    "الدخل المسجل",
    "Rendimentos registados",
    "Entrate registrate",
    "Доходы зарегистрированы"
  ),
  "Expenses recorded": row(
    "Erfasste Ausgaben",
    "Gastos registrados",
    "Shpenzimet e regjistruara",
    "المصروفات المسجلة",
    "Despesas registadas",
    "Spese registrate",
    "Расходы зарегистрированы"
  ),
  "All currencies converted to EUR": row(
    "Alle Währungen in EUR umgerechnet",
    "Todas las monedas convertidas a EUR",
    "Të gjitha monedhat të konvertuara në EUR",
    "تم تحويل جميع العملات إلى اليورو",
    "Todas as moedas convertidas para EUR",
    "Tutte le valute convertite in EUR",
    "Все валюты конвертированы в EUR"
  ),
  "Saving transfers are shown separately": row(
    "Spartransfers werden separat angezeigt",
    "Las transferencias de ahorro se muestran por separado",
    "Transferimet e kursimeve shfaqen veçmas",
    "تُعرض تحويلات الادخار بشكل منفصل",
    "As transferências para poupança são apresentadas separadamente",
    "I trasferimenti verso i risparmi sono mostrati separatamente",
    "Переводы в сбережения отображаются отдельно"
  ),
  "Completed income minus completed outflows through today": row(
    "Abgeschlossene Einnahmen abzüglich abgeschlossener Ausgaben bis heute",
    "Ingresos completados menos gastos completados hasta hoy",
    "Të ardhurat e përfunduara minus daljet e përfunduara deri më sot",
    "الدخل المكتمل مطروحًا منه المصروفات المكتملة حتى اليوم",
    "Rendimentos concluídos menos despesas concluídas até hoje",
    "Entrate completate meno uscite completate fino a oggi",
    "Завершённые доходы за вычетом завершённых расходов по текущую дату"
  ),
  "Total savings rate": row(
    "Gesamtsparquote",
    "Tasa total de ahorro",
    "Norma totale e kursimit",
    "معدل الادخار الإجمالي",
    "Taxa total de poupança",
    "Tasso di risparmio totale",
    "Общая норма сбережений"
  ),
  "All recorded savings divided by income": row(
    "Alle erfassten Ersparnisse geteilt durch die Einnahmen",
    "Todos los ahorros registrados divididos por los ingresos",
    "Të gjitha kursimet e regjistruara pjesëtuar me të ardhurat",
    "جميع المدخرات المسجلة مقسومة على الدخل",
    "Todas as poupanças registadas divididas pelo rendimento",
    "Tutti i risparmi registrati divisi per le entrate",
    "Все зарегистрированные сбережения, разделённые на доходы"
  ),
  "Live transaction table": row(
    "Live-Transaktionstabelle",
    "Tabla de transacciones en vivo",
    "Tabela e transaksioneve drejtpërdrejt",
    "جدول المعاملات المباشر",
    "Tabela de transações em tempo real",
    "Tabella delle transazioni in tempo reale",
    "Таблица транзакций в реальном времени"
  ),
  "Completed and scheduled entries update instantly when data changes.": row(
    "Abgeschlossene und geplante Einträge werden bei Datenänderungen sofort aktualisiert.",
    "Las entradas completadas y programadas se actualizan al instante cuando cambian los datos.",
    "Regjistrimet e përfunduara dhe të planifikuara përditësohen menjëherë kur ndryshojnë të dhënat.",
    "يتم تحديث الإدخالات المكتملة والمجدولة فور تغيّر البيانات.",
    "As entradas concluídas e agendadas são atualizadas imediatamente quando os dados mudam.",
    "Le voci completate e programmate si aggiornano immediatamente quando cambiano i dati.",
    "Завершённые и запланированные записи обновляются сразу при изменении данных."
  ),
  "Protect": row(
    "Schützen",
    "Proteger",
    "Mbro",
    "حماية",
    "Proteger",
    "Proteggi",
    "Защита"
  ),
  "Set up": row(
    "Einrichten",
    "Configurar",
    "Konfiguro",
    "الإعداد",
    "Configurar",
    "Configura",
    "Настройка"
  ),
  "Stabilize": row(
    "Stabilisieren",
    "Estabilizar",
    "Stabilizo",
    "تحقيق الاستقرار",
    "Estabilizar",
    "Stabilizza",
    "Стабилизация"
  ),
  "Build": row(
    "Aufbauen",
    "Construir",
    "Ndërto",
    "بناء",
    "Construir",
    "Costruisci",
    "Создание"
  ),
  "Grow": row(
    "Wachsen",
    "Crecer",
    "Rritu",
    "نمو",
    "Crescer",
    "Cresci",
    "Рост"
  ),
  "Freedom": row(
    "Freiheit",
    "Libertad",
    "Liria",
    "الحرية",
    "Liberdade",
    "Libertà",
    "Свобода"
  ),
  "Build the first emergency buffer": row(
    "Erste Notfallreserve aufbauen",
    "Construir el primer colchón de emergencia",
    "Ndërto rezervën e parë të emergjencës",
    "ابنِ أول احتياطي للطوارئ",
    "Criar a primeira reserva de emergência",
    "Costruisci la prima riserva di emergenza",
    "Создать первый резерв на чрезвычайные ситуации"
  ),
  "The current reserve does not yet cover one full average month of recorded expenses.": row(
    "Die aktuelle Reserve deckt noch keinen vollständigen durchschnittlichen Monat der erfassten Ausgaben ab.",
    "La reserva actual todavía no cubre un mes medio completo de gastos registrados.",
    "Rezerva aktuale ende nuk mbulon një muaj të plotë mesatar të shpenzimeve të regjistruara.",
    "لا يغطي الاحتياطي الحالي بعد شهرًا متوسطًا كاملًا من المصروفات المسجلة.",
    "A reserva atual ainda não cobre um mês médio completo de despesas registadas.",
    "La riserva attuale non copre ancora un mese medio completo di spese registrate.",
    "Текущий резерв пока не покрывает полный средний месяц зарегистрированных расходов."
  ),
  "Prioritize the first one-month reserve before increasing lower-priority allocations.": row(
    "Priorisiere zunächst eine Reserve für einen Monat, bevor du Mittel für niedrigere Prioritäten erhöhst.",
    "Prioriza primero una reserva de un mes antes de aumentar asignaciones de menor prioridad.",
    "Jepi përparësi fillimisht një rezerve për një muaj përpara se të rrisësh shpërndarjet me prioritet më të ulët.",
    "أعطِ الأولوية أولًا لاحتياطي يغطي شهرًا واحدًا قبل زيادة المخصصات الأقل أولوية.",
    "Dê prioridade primeiro a uma reserva de um mês antes de aumentar alocações de prioridade inferior.",
    "Dai priorità prima a una riserva di un mese, prima di aumentare le allocazioni a priorità inferiore.",
    "Сначала создайте резерв на один месяц, прежде чем увеличивать отчисления на менее приоритетные цели."
  ),
  "Strengthen financial resilience": row(
    "Finanzielle Widerstandsfähigkeit stärken",
    "Fortalecer la resiliencia financiera",
    "Forco qëndrueshmërinë financiare",
    "تعزيز المرونة المالية",
    "Reforçar a resiliência financeira",
    "Rafforza la resilienza finanziaria",
    "Укрепить финансовую устойчивость"
  ),
  "Preserve the emergency reserve": row(
    "Notfallreserve erhalten",
    "Preservar la reserva de emergencia",
    "Ruaj rezervën e emergjencës",
    "الحفاظ على احتياطي الطوارئ",
    "Preservar a reserva de emergência",
    "Preserva la riserva di emergenza",
    "Сохранить резерв на чрезвычайные ситуации"
  ),
  "Resolve overdue obligations first": row(
    "Überfällige Verpflichtungen zuerst klären",
    "Resolver primero las obligaciones vencidas",
    "Zgjidh fillimisht detyrimet e vonuara",
    "عالج الالتزامات المتأخرة أولًا",
    "Resolver primeiro as obrigações em atraso",
    "Risolvi prima gli obblighi scaduti",
    "Сначала урегулировать просроченные обязательства"
  ),
  "Establish an income baseline": row(
    "Einkommensbasis festlegen",
    "Establecer una base de ingresos",
    "Vendos bazën e të ardhurave",
    "إنشاء خط أساس للدخل",
    "Estabelecer uma base de rendimento",
    "Stabilisci una base delle entrate",
    "Сформировать базовый уровень дохода"
  ),
  "Restore positive monthly cash flow": row(
    "Positiven monatlichen Cashflow wiederherstellen",
    "Restablecer un flujo de caja mensual positivo",
    "Rikthe rrjedhën mujore pozitive të parasë",
    "استعادة تدفق نقدي شهري إيجابي",
    "Restabelecer um fluxo de caixa mensal positivo",
    "Ripristina un flusso di cassa mensile positivo",
    "Восстановить положительный ежемесячный денежный поток"
  ),
  "Create more monthly breathing room": row(
    "Mehr monatlichen finanziellen Spielraum schaffen",
    "Crear más margen mensual",
    "Krijo më shumë hapësirë mujore financiare",
    "أنشئ مساحة مالية شهرية أكبر",
    "Criar mais margem mensal",
    "Crea più margine mensile",
    "Создать больший ежемесячный финансовый запас"
  ),
  "Protect the positive cash-flow margin": row(
    "Positiven Cashflow-Spielraum schützen",
    "Proteger el margen positivo de flujo de caja",
    "Mbro diferencën pozitive të rrjedhës së parasë",
    "حماية هامش التدفق النقدي الإيجابي",
    "Proteger a margem positiva de fluxo de caixa",
    "Proteggi il margine positivo del flusso di cassa",
    "Защитить положительный запас денежного потока"
  ),
  "Reduce debt pressure deliberately": row(
    "Schuldendruck gezielt reduzieren",
    "Reducir deliberadamente la presión de la deuda",
    "Ul presionin e borxhit në mënyrë të qëllimshme",
    "خفض ضغط الديون بشكل مدروس",
    "Reduzir deliberadamente a pressão da dívida",
    "Riduci deliberatamente la pressione del debito",
    "Целенаправленно снизить долговую нагрузку"
  ),
  "Keep debt reduction visible": row(
    "Schuldenabbau sichtbar halten",
    "Mantener visible la reducción de deuda",
    "Mbaje të dukshëm uljen e borxhit",
    "إبقاء خفض الديون واضحًا",
    "Manter visível a redução da dívida",
    "Mantieni visibile la riduzione del debito",
    "Сохранять прогресс погашения долга на виду"
  ),
  "Preserve borrowing flexibility": row(
    "Kreditspielraum erhalten",
    "Preservar la flexibilidad de endeudamiento",
    "Ruaj fleksibilitetin e huamarrjes",
    "الحفاظ على مرونة الاقتراض",
    "Preservar a flexibilidade de crédito",
    "Preserva la flessibilità di indebitamento",
    "Сохранить гибкость заимствований"
  ),
  "Start a repeatable saving habit": row(
    "Eine nachhaltige Sparroutine beginnen",
    "Iniciar un hábito de ahorro repetible",
    "Fillo një zakon të qëndrueshëm kursimi",
    "ابدأ عادة ادخار قابلة للاستمرار",
    "Iniciar um hábito de poupança consistente",
    "Avvia un'abitudine di risparmio ripetibile",
    "Начать устойчивую привычку сбережений"
  ),
  "Raise the saving pace gradually": row(
    "Spartempo schrittweise erhöhen",
    "Aumentar gradualmente el ritmo de ahorro",
    "Rrit gradualisht ritmin e kursimit",
    "ارفع وتيرة الادخار تدريجيًا",
    "Aumentar gradualmente o ritmo de poupança",
    "Aumenta gradualmente il ritmo di risparmio",
    "Постепенно увеличить темп сбережений"
  ),
  "Maintain the saving momentum": row(
    "Spardynamik beibehalten",
    "Mantener el impulso del ahorro",
    "Ruaj ritmin e kursimit",
    "حافظ على زخم الادخار",
    "Manter o ritmo de poupança",
    "Mantieni lo slancio del risparmio",
    "Сохранить темп сбережений"
  ),
  "Move net worth toward positive territory": row(
    "Nettovermögen in den positiven Bereich bringen",
    "Llevar el patrimonio neto a terreno positivo",
    "Çoje pasurinë neto drejt territorit pozitiv",
    "نقل صافي الثروة إلى المنطقة الإيجابية",
    "Levar o património líquido para terreno positivo",
    "Porta il patrimonio netto in territorio positivo",
    "Вывести чистый капитал в положительную зону"
  ),
  "Build on the positive wealth position": row(
    "Auf der positiven Vermögensposition aufbauen",
    "Aprovechar la posición patrimonial positiva",
    "Ndërto mbi pozicionin pozitiv të pasurisë",
    "البناء على وضع الثروة الإيجابي",
    "Construir sobre a posição patrimonial positiva",
    "Consolida la posizione patrimoniale positiva",
    "Развивать положительную позицию капитала"
  ),
  "Connect cash flow to a measurable goal": row(
    "Cashflow mit einem messbaren Ziel verbinden",
    "Conectar el flujo de caja con un objetivo medible",
    "Lidhe rrjedhën e parasë me një objektiv të matshëm",
    "اربط التدفق النقدي بهدف قابل للقياس",
    "Ligar o fluxo de caixa a um objetivo mensurável",
    "Collega il flusso di cassa a un obiettivo misurabile",
    "Связать денежный поток с измеримой целью"
  ),
  "Keep goal funding aligned": row(
    "Zielfinanzierung ausgerichtet halten",
    "Mantener alineada la financiación de objetivos",
    "Mbaje financimin e objektivave të harmonizuar",
    "حافظ على مواءمة تمويل الأهداف",
    "Manter alinhado o financiamento dos objetivos",
    "Mantieni allineato il finanziamento degli obiettivi",
    "Сохранять финансирование целей согласованным"
  ),
  "Activate the monthly planner": row(
    "Monatsplaner aktivieren",
    "Activar el planificador mensual",
    "Aktivizo planifikuesin mujor",
    "تفعيل المخطط الشهري",
    "Ativar o planeador mensal",
    "Attiva il pianificatore mensile",
    "Активировать ежемесячный план"
  ),
  "Forecast confidence is still developing": row(
    "Die Prognoseaussagekraft befindet sich noch im Aufbau",
    "La confianza de la previsión aún está desarrollándose",
    "Besueshmëria e parashikimit është ende në zhvillim",
    "لا تزال موثوقية التوقعات قيد التطور",
    "A confiança da previsão ainda está em desenvolvimento",
    "L'affidabilità della previsione è ancora in sviluppo",
    "Надёжность прогноза всё ещё формируется"
  ),
  "Prepare for a negative one-month outlook": row(
    "Auf einen negativen Einmonatsausblick vorbereiten",
    "Prepararse para una perspectiva mensual negativa",
    "Përgatitu për një parashikim negativ njëmujor",
    "استعد لتوقع سلبي لشهر واحد",
    "Preparar-se para uma perspetiva negativa de um mês",
    "Preparati a una prospettiva negativa a un mese",
    "Подготовиться к отрицательному прогнозу на месяц"
  ),
  "Net-worth trend needs more history": row(
    "Nettovermögenstrend benötigt mehr Historie",
    "La tendencia del patrimonio neto necesita más historial",
    "Trendi i pasurisë neto kërkon më shumë histori",
    "اتجاه صافي الثروة يحتاج إلى سجل أطول",
    "A tendência do património líquido precisa de mais histórico",
    "La tendenza del patrimonio netto richiede più storico",
    "Тренду чистого капитала требуется больше истории"
  ),
  "Keep fixed commitments funded": row(
    "Feste Verpflichtungen finanziell absichern",
    "Mantener financiados los compromisos fijos",
    "Mbaji të financuara detyrimet fikse",
    "حافظ على تمويل الالتزامات الثابتة",
    "Manter financiados os compromissos fixos",
    "Mantieni finanziati gli impegni fissi",
    "Обеспечить финансирование фиксированных обязательств"
  ),
  "Make independence progress repeatable": row(
    "Fortschritt zur Unabhängigkeit wiederholbar machen",
    "Hacer repetible el progreso hacia la independencia",
    "Bëje të përsëritshëm progresin drejt pavarësisë",
    "اجعل التقدم نحو الاستقلال قابلًا للاستمرار",
    "Tornar repetível o progresso rumo à independência",
    "Rendi ripetibile il progresso verso l'indipendenza",
    "Сделать прогресс к независимости устойчивым"
  ),
  "Improve data coverage before relying on long-term conclusions": row(
    "Datenabdeckung verbessern, bevor langfristige Schlussfolgerungen gezogen werden",
    "Mejorar la cobertura de datos antes de confiar en conclusiones a largo plazo",
    "Përmirëso mbulimin e të dhënave përpara se të mbështetesh në përfundime afatgjata",
    "حسّن تغطية البيانات قبل الاعتماد على استنتاجات طويلة الأجل",
    "Melhorar a cobertura de dados antes de confiar em conclusões de longo prazo",
    "Migliora la copertura dei dati prima di affidarti a conclusioni di lungo periodo",
    "Улучшить полноту данных перед долгосрочными выводами"
  )
});


// V32: smallest visible interface fragments and enum labels. These entries
// prevent lowercase/status fragments from leaking English into localized UI.
Object.assign(RUNTIME_TRANSLATIONS, {
  "error": row("Fehler", "error", "gabim", "خطأ", "erro", "errore", "ошибка"),
  "success": row("Erfolg", "éxito", "sukses", "نجاح", "sucesso", "successo", "успех"),
  "restore": row("wiederherstellen", "restaurar", "rikthe", "استعادة", "restaurar", "ripristina", "восстановить"),
  "suspend": row("sperren", "suspender", "pezullo", "تعليق", "suspender", "sospendi", "приостановить"),
  "page": row("Seite", "página", "faqe", "صفحة", "página", "pagina", "страница"),
  "current-password": row("aktuelles Passwort", "contraseña actual", "fjalëkalimi aktual", "كلمة المرور الحالية", "palavra-passe atual", "password attuale", "текущий пароль"),
  "new-password": row("neues Passwort", "nueva contraseña", "fjalëkalimi i ri", "كلمة المرور الجديدة", "nova palavra-passe", "nuova password", "новый пароль"),
  "or": row("oder", "o", "ose", "أو", "ou", "o", "или"),
  "at": row("um", "a las", "në", "في", "às", "alle", "в"),
  "ACCOUNTABILITY": row("VERANTWORTLICHKEIT", "RESPONSABILIDAD", "PËRGJEGJSHMËRIA", "المساءلة", "RESPONSABILIDADE", "RESPONSABILITÀ", "ОТВЕТСТВЕННОСТЬ"),
  "variable": row("variabel", "variable", "e ndryshueshme", "متغير", "variável", "variabile", "переменные"),
  "SUPPLIERS": row("LIEFERANTEN", "PROVEEDORES", "FURNIZUESIT", "الموردون", "FORNECEDORES", "FORNITORI", "ПОСТАВЩИКИ"),
  "PROFITABILITY": row("RENTABILITÄT", "RENTABILIDAD", "FITIMPRURJA", "الربحية", "RENTABILIDADE", "REDDITIVITÀ", "РЕНТАБЕЛЬНОСТЬ"),
  "cost": row("Kosten", "coste", "kosto", "تكلفة", "custo", "costo", "затраты"),
  "converted": row("umgerechnet", "convertido", "konvertuar", "محوّل", "convertido", "convertito", "конвертировано"),
  "RESPONSIBILITY": row("VERANTWORTUNG", "RESPONSABILIDAD", "PËRGJEGJËSIA", "المسؤولية", "RESPONSABILIDADE", "RESPONSABILITÀ", "ОТВЕТСТВЕННОСТЬ"),
  "reversed": row("storniert", "revertido", "përmbysur", "معكوس", "revertido", "stornato", "отменено"),
  "button": row("Schaltfläche", "botón", "buton", "زر", "botão", "pulsante", "кнопка"),
  "income": row("Einnahmen", "ingresos", "të ardhura", "الدخل", "rendimento", "entrate", "доходы"),
  "gross": row("Brutto", "bruto", "bruto", "إجمالي", "bruto", "lordo", "валовая"),
  "operating": row("Betrieb", "operativo", "operativ", "تشغيلي", "operacional", "operativo", "операционная"),
  "transactions": row("Transaktionen", "transacciones", "transaksione", "المعاملات", "transações", "transazioni", "транзакции"),
  "overdue": row("überfällig", "vencido", "me vonesë", "متأخر", "em atraso", "scaduto", "просрочено"),
  "available": row("verfügbar", "disponible", "në dispozicion", "متاح", "disponível", "disponibile", "доступно"),
  "line": row("Position", "línea", "rresht", "بند", "linha", "riga", "строка"),
  "archived": row("archiviert", "archivado", "arkivuar", "مؤرشف", "arquivado", "archiviato", "в архиве"),
  "activity": row("Aktivität", "actividad", "aktivitet", "النشاط", "atividade", "attività", "активность"),
  "amount_eur": row("Betrag (EUR)", "importe (EUR)", "shuma (EUR)", "المبلغ (EUR)", "montante (EUR)", "importo (EUR)", "сумма (EUR)"),
  "active": row("aktiv", "activo", "aktiv", "نشط", "ativo", "attivo", "активно"),
  "card": row("Karte", "tarjeta", "kartë", "بطاقة", "cartão", "carta", "карта"),
  "cards": row("Karten", "tarjetas", "karta", "بطاقات", "cartões", "carte", "карты"),
  "original": row("ursprünglich", "original", "origjinal", "أصلي", "original", "originale", "исходное"),
  "paid": row("bezahlt", "pagado", "paguar", "مدفوع", "pago", "pagato", "оплачено"),
  "optional": row("optional", "opcional", "opsionale", "اختياري", "opcional", "facoltativo", "необязательно"),
  "assumption.": row("Annahme.", "supuesto.", "supozim.", "افتراض.", "pressuposto.", "ipotesi.", "предположение."),
  "step": row("Schritt", "paso", "hap", "خطوة", "passo", "passaggio", "шаг"),
  "GOALS": row("ZIELE", "OBJETIVOS", "OBJEKTIVAT", "الأهداف", "OBJETIVOS", "OBIETTIVI", "ЦЕЛИ"),
  "/ 3 required": row("/ 3 erforderlich", "/ 3 requeridos", "/ 3 të kërkuara", "/ 3 مطلوبة", "/ 3 necessários", "/ 3 richiesti", "/ 3 требуется"),
  "repaid": row("zurückgezahlt", "reembolsado", "shlyer", "مسدد", "reembolsado", "rimborsato", "погашено"),
  "text": row("Text", "texto", "tekst", "نص", "texto", "testo", "текст"),
  "password": row("Passwort", "contraseña", "fjalëkalim", "كلمة المرور", "palavra-passe", "password", "пароль"),
  "users": row("Benutzer", "usuarios", "përdorues", "المستخدمون", "utilizadores", "utenti", "пользователи"),
  "total": row("gesamt", "total", "totali", "الإجمالي", "total", "totale", "итого"),
  "session": row("Sitzung", "sesión", "sesion", "جلسة", "sessão", "sessione", "сеанс"),
  "sessions": row("Sitzungen", "sesiones", "sesione", "جلسات", "sessões", "sessioni", "сеансы"),
  "contributions": row("Beiträge", "aportaciones", "kontribute", "المساهمات", "contribuições", "contributi", "взносы"),
  "annual": row("jährlich", "anual", "vjetore", "سنوي", "anual", "annuale", "ежегодно"),
  "monthly": row("monatlich", "mensual", "mujore", "شهري", "mensal", "mensile", "ежемесячно"),
  "forever": row("dauerhaft", "para siempre", "përgjithmonë", "دائمًا", "para sempre", "per sempre", "навсегда"),
  "/ year": row("/ Jahr", "/ año", "/ vit", "/ سنة", "/ ano", "/ anno", "/ год"),
  "/ month": row("/ Monat", "/ mes", "/ muaj", "/ شهر", "/ mês", "/ mese", "/ месяц"),
  "mixed": row("gemischt", "mixto", "e përzier", "مختلط", "misto", "misto", "смешанный"),
  "selected": row("ausgewählt", "seleccionado", "zgjedhur", "محدد", "selecionado", "selezionato", "выбрано"),
  "not_released": row("nicht veröffentlicht", "no publicado", "i papublikuar", "غير متاح بعد", "não lançado", "non rilasciato", "не выпущено"),
  "unauthenticated": row("nicht angemeldet", "sin autenticar", "i paautentikuar", "غير مسجل الدخول", "não autenticado", "non autenticato", "не авторизован"),
  "upgrade_required": row("Upgrade erforderlich", "se requiere mejora de plan", "kërkohet përmirësim", "يلزم ترقية الخطة", "é necessário atualizar o plano", "upgrade richiesto", "требуется повышение тарифа")
});

const cache = new Map<string, string>();
const MAX_CACHE = 3000;

function cacheSet(key: string, value: string) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

function dynamicTranslation(
  language: NonEnglishLanguage,
  source: string,
): string | null {
  let match: RegExpMatchArray | null;

  match = source.match(/^(\d+(?:[.,]\d+)?)%\s+complete$/i);
  if (match) {
    const prefix: Record<NonEnglishLanguage, string> = {
      de: `${match[1]}% abgeschlossen`,
      es: `${match[1]}% completado`,
      sq: `${match[1]}% përfunduar`,
      ar: `مكتمل بنسبة ${match[1]}%`,
      pt: `${match[1]}% concluído`,
      it: `${match[1]}% completato`,
      ru: `${match[1]}% завершено`,
    };
    return prefix[language];
  }

  match = source.match(/^Stage\s+(\d+)\s+of\s+(\d+)$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `Stufe ${match[1]} von ${match[2]}`,
      es: `Etapa ${match[1]} de ${match[2]}`,
      sq: `Faza ${match[1]} nga ${match[2]}`,
      ar: `المرحلة ${match[1]} من ${match[2]}`,
      pt: `Etapa ${match[1]} de ${match[2]}`,
      it: `Fase ${match[1]} di ${match[2]}`,
      ru: `Этап ${match[1]} из ${match[2]}`,
    };
    return t[language];
  }

  match = source.match(/^Page\s+(\d+)\s+of\s+(\d+)$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `Seite ${match[1]} von ${match[2]}`,
      es: `Página ${match[1]} de ${match[2]}`,
      sq: `Faqja ${match[1]} nga ${match[2]}`,
      ar: `الصفحة ${match[1]} من ${match[2]}`,
      pt: `Página ${match[1]} de ${match[2]}`,
      it: `Pagina ${match[1]} di ${match[2]}`,
      ru: `Страница ${match[1]} из ${match[2]}`,
    };
    return t[language];
  }

  match = source.match(/^(\d+)\s+days?\s+(remaining|left)$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `${match[1]} Tage verbleibend`,
      es: `${match[1]} días restantes`,
      sq: `${match[1]} ditë të mbetura`,
      ar: `متبقي ${match[1]} يوم`,
      pt: `${match[1]} dias restantes`,
      it: `${match[1]} giorni rimanenti`,
      ru: `Осталось ${match[1]} дней`,
    };
    return t[language];
  }

  match = source.match(/^Due\s+in\s+(\d+)\s+days?$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `Fällig in ${match[1]} Tagen`,
      es: `Vence en ${match[1]} días`,
      sq: `Afati pas ${match[1]} ditësh`,
      ar: `مستحق خلال ${match[1]} يوم`,
      pt: `Vence em ${match[1]} dias`,
      it: `Scade tra ${match[1]} giorni`,
      ru: `Срок оплаты через ${match[1]} дней`,
    };
    return t[language];
  }

  match = source.match(/^Next\s+income\s+in\s+(\d+)\s+days?$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `Nächstes Einkommen in ${match[1]} Tagen`,
      es: `Próximo ingreso en ${match[1]} días`,
      sq: `Të ardhurat e radhës pas ${match[1]} ditësh`,
      ar: `الدخل القادم خلال ${match[1]} يوم`,
      pt: `Próximo rendimento em ${match[1]} dias`,
      it: `Prossimo reddito tra ${match[1]} giorni`,
      ru: `Следующий доход через ${match[1]} дней`,
    };
    return t[language];
  }

  match = source.match(/^Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)\s+transactions?$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `Transaktionen ${match[1]} bis ${match[2]} von ${match[3]}`,
      es: `Mostrando ${match[1]} a ${match[2]} de ${match[3]} transacciones`,
      sq: `Duke shfaqur ${match[1]} deri ${match[2]} nga ${match[3]} transaksione`,
      ar: `عرض ${match[1]} إلى ${match[2]} من ${match[3]} معاملة`,
      pt: `A mostrar ${match[1]} a ${match[2]} de ${match[3]} transações`,
      it: `Visualizzazione da ${match[1]} a ${match[2]} di ${match[3]} transazioni`,
      ru: `Показаны ${match[1]}–${match[2]} из ${match[3]} транзакций`,
    };
    return t[language];
  }


  match = source.match(/^(Set up|Stabilize|Protect|Build|Grow|Freedom)\s+·\s+Stage\s+(\d+)$/i);
  if (match) {
    const stageSource =
      match[1].charAt(0).toUpperCase() +
      match[1].slice(1).toLowerCase();
    const translatedStage =
      RUNTIME_TRANSLATIONS[stageSource]?.[language] ?? stageSource;
    const stageWord: Record<NonEnglishLanguage, string> = {
      de: "Stufe",
      es: "Etapa",
      sq: "Faza",
      ar: "المرحلة",
      pt: "Etapa",
      it: "Fase",
      ru: "Этап",
    };
    return `${translatedStage} · ${stageWord[language]} ${match[2]}`;
  }

  match = source.match(/^(\d+)%\s+through\s+the\s+FICONTER\s+financial\s+journey$/i);
  if (match) {
    const t: Record<NonEnglishLanguage, string> = {
      de: `${match[1]}% der finanziellen FICONTER-Reise abgeschlossen`,
      es: `${match[1]}% del recorrido financiero de FICONTER completado`,
      sq: `${match[1]}% e rrugëtimit financiar FICONTER i përfunduar`,
      ar: `تم إكمال ${match[1]}% من رحلة FICONTER المالية`,
      pt: `${match[1]}% do percurso financeiro FICONTER concluído`,
      it: `${match[1]}% del percorso finanziario FICONTER completato`,
      ru: `Пройдено ${match[1]}% финансового пути FICONTER`,
    };
    return t[language];
  }

  const countNoun = source.match(/^(\d+)\s+(transactions?|bills?|goals?|debts?|payments?)$/i);
  if (countNoun) {
    const number = countNoun[1];
    const noun = countNoun[2].toLowerCase();
    const keys: Record<string, string> = {
      transaction: "Transactions",
      transactions: "Transactions",
      bill: "Bills",
      bills: "Bills",
      goal: "Goals",
      goals: "Goals",
      debt: "Debts",
      debts: "Debts",
      payment: "Payments",
      payments: "Payments",
    };
    const translated = translatePhrase(language, keys[noun] ?? noun);
    return `${number} ${translated}`;
  }

  match = source.match(/^(\d+)\s+bills?\s+due\s+this\s+(week|month)$/i);
  if (match) {
    const unit = match[2].toLowerCase();
    const t: Record<NonEnglishLanguage, string> = unit === "week"
      ? {
          de: `${match[1]} Rechnungen diese Woche fällig`,
          es: `${match[1]} facturas vencen esta semana`,
          sq: `${match[1]} fatura kanë afat këtë javë`,
          ar: `${match[1]} فواتير مستحقة هذا الأسبوع`,
          pt: `${match[1]} contas vencem esta semana`,
          it: `${match[1]} bollette in scadenza questa settimana`,
          ru: `${match[1]} счетов к оплате на этой неделе`,
        }
      : {
          de: `${match[1]} Rechnungen diesen Monat fällig`,
          es: `${match[1]} facturas vencen este mes`,
          sq: `${match[1]} fatura kanë afat këtë muaj`,
          ar: `${match[1]} فواتير مستحقة هذا الشهر`,
          pt: `${match[1]} contas vencem este mês`,
          it: `${match[1]} bollette in scadenza questo mese`,
          ru: `${match[1]} счетов к оплате в этом месяце`,
        };
    return t[language];
  }

  return null;
}

export function translateRuntimePhrase(
  language: FiconterLanguage,
  source: string,
): string {
  if (language === "en" || !source.trim()) return source;

  const cacheKey = `${language}\u0000${source}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const exact =
    PHRASE_TRANSLATIONS[source]?.[language] ??
    RUNTIME_TRANSLATIONS[source]?.[language] ??
    FULL_UI_TRANSLATIONS[source]?.[language] ??
    WEALTH_UI_TRANSLATIONS[source]?.[language];

  if (exact) {
    cacheSet(cacheKey, exact);
    return exact;
  }

  const dynamic = dynamicTranslation(language, source);
  if (dynamic) {
    cacheSet(cacheKey, dynamic);
    return dynamic;
  }

  const translateTemplateToken = (token: string): string => {
    const direct =
      PHRASE_TRANSLATIONS[token]?.[language] ??
      RUNTIME_TRANSLATIONS[token]?.[language] ??
      FULL_UI_TRANSLATIONS[token]?.[language] ??
      WEALTH_UI_TRANSLATIONS[token]?.[language];
    if (direct) return direct;

    const lower = token.toLocaleLowerCase("en");
    for (const catalog of [
      PHRASE_TRANSLATIONS,
      RUNTIME_TRANSLATIONS,
      FULL_UI_TRANSLATIONS,
      WEALTH_UI_TRANSLATIONS,
    ] as const) {
      for (const [key, row] of Object.entries(catalog)) {
        if (key.toLocaleLowerCase("en") === lower) {
          const translated = row[language as NonEnglishLanguage];
          if (translated) return translated;
        }
      }
    }

    return token;
  };

  const wealthTemplate = translateWealthTemplate(
    language,
    source,
    translateTemplateToken,
  );

  if (wealthTemplate) {
    cacheSet(cacheKey, wealthTemplate);
    return wealthTemplate;
  }

  const globalTemplate = translateGlobalTemplate(
    language,
    source,
    translateTemplateToken,
  );

  if (globalTemplate) {
    cacheSet(cacheKey, globalTemplate);
    return globalTemplate;
  }

  // Never produce mixed-language interface text. If a complete translation
  // is not known, preserve the original source sentence as one unit.
  cacheSet(cacheKey, source);
  return source;
}
