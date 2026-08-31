import type { FiconterLanguage } from "./config";
import { translateRuntimePhrase } from "./runtimeTranslator";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;
type Row = Record<NonEnglishLanguage, string>;

const exact: Record<string, Row> = {
  "Finish setup": {
    de: "Einrichtung abschließen", es: "Completar configuración", sq: "Përfundo konfigurimin", ar: "أكمل الإعداد", pt: "Concluir configuração", it: "Completa la configurazione", ru: "Завершить настройку",
  },
  "Smart insights": {
    de: "Intelligente Einblicke", es: "Análisis inteligentes", sq: "Analiza inteligjente", ar: "رؤى ذكية", pt: "Análises inteligentes", it: "Analisi intelligenti", ru: "Умная аналитика",
  },
  "A full month will unlock spending comparisons": {
    de: "Ein vollständiger Monat ermöglicht Ausgabenvergleiche", es: "Un mes completo habilitará comparaciones de gastos", sq: "Një muaj i plotë do të mundësojë krahasimet e shpenzimeve", ar: "سيتيح شهر كامل مقارنات الإنفاق", pt: "Um mês completo permitirá comparar despesas", it: "Un mese completo abiliterà i confronti delle spese", ru: "Полный месяц откроет сравнение расходов",
  },
  "No monthly spending budget has been set": {
    de: "Es wurde kein monatliches Ausgabenbudget festgelegt", es: "No se ha establecido un presupuesto mensual de gastos", sq: "Nuk është caktuar buxhet mujor shpenzimesh", ar: "لم يتم تحديد ميزانية إنفاق شهرية", pt: "Não foi definido um orçamento mensal de despesas", it: "Non è stato impostato un budget mensile di spesa", ru: "Месячный бюджет расходов не задан",
  },
  "No upcoming bills. Your horizon is clear.": {
    de: "Keine anstehenden Rechnungen. Dein Horizont ist frei.", es: "No hay facturas próximas. Tu horizonte está despejado.", sq: "Nuk ka fatura të ardhshme. Horizonti yt është i lirë.", ar: "لا توجد فواتير قادمة. أفقك واضح.", pt: "Sem contas futuras. O seu horizonte está livre.", it: "Nessuna bolletta in arrivo. Il tuo orizzonte è libero.", ru: "Предстоящих счетов нет. Горизонт свободен.",
  },
  "Set a monthly budget": {
    de: "Monatsbudget festlegen", es: "Establecer presupuesto mensual", sq: "Cakto buxhet mujor", ar: "تحديد ميزانية شهرية", pt: "Definir orçamento mensal", it: "Imposta un budget mensile", ru: "Задать месячный бюджет",
  },
};

export function translateOverviewRuntime(language: FiconterLanguage, source: string): string {
  if (language === "en" || !source.trim()) return source;

  const base = translateRuntimePhrase(language, source);
  if (base !== source) return base;

  const row = exact[source];
  if (row) return row[language];

  let match = source.match(/^Spending is (\d+(?:[.,]\d+)?)% (lower|higher) this month$/i);
  if (match) {
    const n = match[1];
    const lower = match[2].toLowerCase() === "lower";
    const values: Row = lower ? {
      de: `Die Ausgaben sind diesen Monat ${n}% niedriger`, es: `El gasto es un ${n}% menor este mes`, sq: `Shpenzimet janë ${n}% më të ulëta këtë muaj`, ar: `الإنفاق أقل بنسبة ${n}% هذا الشهر`, pt: `As despesas estão ${n}% mais baixas este mês`, it: `Le spese sono inferiori del ${n}% questo mese`, ru: `Расходы в этом месяце ниже на ${n}%`,
    } : {
      de: `Die Ausgaben sind diesen Monat ${n}% höher`, es: `El gasto es un ${n}% mayor este mes`, sq: `Shpenzimet janë ${n}% më të larta këtë muaj`, ar: `الإنفاق أعلى بنسبة ${n}% هذا الشهر`, pt: `As despesas estão ${n}% mais altas este mês`, it: `Le spese sono superiori del ${n}% questo mese`, ru: `Расходы в этом месяце выше на ${n}%`,
    };
    return values[language];
  }

  match = source.match(/^(\d+)% of the monthly spending budget used$/i);
  if (match) {
    const n = match[1];
    const values: Row = {
      de: `${n}% des monatlichen Ausgabenbudgets verwendet`, es: `${n}% del presupuesto mensual de gastos utilizado`, sq: `${n}% e buxhetit mujor të shpenzimeve është përdorur`, ar: `تم استخدام ${n}% من ميزانية الإنفاق الشهرية`, pt: `${n}% do orçamento mensal de despesas utilizado`, it: `${n}% del budget mensile di spesa utilizzato`, ru: `Использовано ${n}% месячного бюджета расходов`,
    };
    return values[language];
  }

  match = source.match(/^(\d+) days? overdue$/i);
  if (match) {
    const n = match[1];
    const values: Row = {
      de: `${n} Tage überfällig`, es: `${n} días de retraso`, sq: `${n} ditë me vonesë`, ar: `متأخر ${n} أيام`, pt: `${n} dias em atraso`, it: `${n} giorni di ritardo`, ru: `Просрочено на ${n} дней`,
    };
    return values[language];
  }

  match = source.match(/^In (\d+) days$/i);
  if (match) {
    const n = match[1];
    const values: Row = {
      de: `In ${n} Tagen`, es: `En ${n} días`, sq: `Pas ${n} ditësh`, ar: `خلال ${n} أيام`, pt: `Em ${n} dias`, it: `Tra ${n} giorni`, ru: `Через ${n} дней`,
    };
    return values[language];
  }

  return source;
}
