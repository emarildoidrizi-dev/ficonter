import type { FiconterLanguage } from "./config";
import { PHRASE_TRANSLATIONS, translatePhrase } from "./phrases";

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

const SOURCE_ENTRIES = Object.entries({
  ...PHRASE_TRANSLATIONS,
  ...RUNTIME_TRANSLATIONS,
})
  .filter(([source]) => source.length >= 3)
  .sort((a, b) => b[0].length - a[0].length);

const cache = new Map<string, string>();
const MAX_CACHE = 3000;

function cacheSet(key: string, value: string) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

function letterCount(value: string): number {
  return (value.match(/\p{L}/gu) ?? []).length;
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

function composedTranslation(
  language: NonEnglishLanguage,
  source: string,
): string {
  if (source.length > 260 || letterCount(source) < 4) return source;

  const lower = source.toLocaleLowerCase("en");
  const occupied = new Array(source.length).fill(false);
  const matches: Array<{ start: number; end: number; translated: string; letters: number }> = [];

  for (const [key, translations] of SOURCE_ENTRIES) {
    const keyLower = key.toLocaleLowerCase("en");
    let from = 0;

    while (from < lower.length) {
      const index = lower.indexOf(keyLower, from);
      if (index < 0) break;
      const end = index + key.length;

      const before = index > 0 ? source[index - 1] : "";
      const after = end < source.length ? source[end] : "";
      const beforeWord = before ? /[\p{L}\p{N}]/u.test(before) : false;
      const afterWord = after ? /[\p{L}\p{N}]/u.test(after) : false;

      if (!beforeWord && !afterWord) {
        let free = true;
        for (let i = index; i < end; i += 1) {
          if (occupied[i]) {
            free = false;
            break;
          }
        }

        if (free) {
          for (let i = index; i < end; i += 1) occupied[i] = true;
          matches.push({
            start: index,
            end,
            translated: translations[language],
            letters: letterCount(key),
          });
        }
      }

      from = index + Math.max(1, key.length);
    }
  }

  if (!matches.length) return source;

  const sourceLetters = letterCount(source);
  const matchedLetters = matches.reduce((sum, item) => sum + item.letters, 0);

  // Avoid ugly half-English / half-translated sentences. A composed fallback
  // is used only when most of the meaningful source can be translated.
  if (!sourceLetters || matchedLetters / sourceLetters < 0.58) return source;

  matches.sort((a, b) => a.start - b.start);

  let result = "";
  let cursor = 0;
  for (const match of matches) {
    result += source.slice(cursor, match.start);
    result += match.translated;
    cursor = match.end;
  }
  result += source.slice(cursor);

  return result;
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
    RUNTIME_TRANSLATIONS[source]?.[language];

  if (exact) {
    cacheSet(cacheKey, exact);
    return exact;
  }

  const dynamic = dynamicTranslation(language, source);
  if (dynamic) {
    cacheSet(cacheKey, dynamic);
    return dynamic;
  }

  const composed = composedTranslation(language, source);
  cacheSet(cacheKey, composed);
  return composed;
}
