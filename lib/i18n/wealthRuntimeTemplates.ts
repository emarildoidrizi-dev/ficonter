import type { FiconterLanguage } from "./config";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;
type TemplateRow = Record<NonEnglishLanguage, string>;

function row(
  de: string,
  es: string,
  sq: string,
  ar: string,
  pt: string,
  it: string,
  ru: string,
): TemplateRow {
  return { de, es, sq, ar, pt, it, ru };
}

export const WEALTH_RUNTIME_TEMPLATES: Record<string, TemplateRow> = {
  "The clearest current priority is to {0}. The strongest verified opportunity is to {1}.": row(
    "Die derzeit klarste Priorität ist: {0}. Die stärkste bestätigte Chance ist: {1}.",
    "La prioridad actual más clara es {0}. La oportunidad verificada más sólida es {1}.",
    "Prioriteti më i qartë aktual është {0}. Mundësia më e fortë e verifikuar është {1}.",
    "الأولوية الحالية الأوضح هي {0}. وأقوى فرصة مؤكدة هي {1}.",
    "A prioridade atual mais clara é {0}. A oportunidade verificada mais forte é {1}.",
    "La priorità attuale più chiara è {0}. L'opportunità verificata più forte è {1}.",
    "Самый ясный текущий приоритет — {0}. Самая сильная подтверждённая возможность — {1}."
  ),
  "The clearest current priority is to {0}. Continue building complete monthly records so FICONTER can strengthen the analysis.": row(
    "Die derzeit klarste Priorität ist: {0}. Führe weiterhin vollständige Monatsaufzeichnungen, damit FICONTER die Analyse verbessern kann.",
    "La prioridad actual más clara es {0}. Sigue creando registros mensuales completos para que FICONTER pueda reforzar el análisis.",
    "Prioriteti më i qartë aktual është {0}. Vazhdo të ndërtosh regjistrime mujore të plota që FICONTER të forcojë analizën.",
    "الأولوية الحالية الأوضح هي {0}. واصل بناء سجلات شهرية كاملة حتى يتمكن FICONTER من تعزيز التحليل.",
    "A prioridade atual mais clara é {0}. Continue a construir registos mensais completos para que o FICONTER possa reforçar a análise.",
    "La priorità attuale più chiara è {0}. Continua a costruire registri mensili completi affinché FICONTER possa rafforzare l'analisi.",
    "Самый ясный текущий приоритет — {0}. Продолжайте формировать полные месячные записи, чтобы FICONTER мог улучшить анализ."
  ),
  "The listed unpaid commitments create an expected shortfall of {0}.": row(
    "Die aufgeführten unbezahlten Verpflichtungen führen voraussichtlich zu einer Lücke von {0}.",
    "Los compromisos impagados indicados generan un déficit esperado de {0}.",
    "Detyrimet e papaguara të listuara krijojnë një mungesë të pritshme prej {0}.",
    "تؤدي الالتزامات غير المدفوعة المدرجة إلى عجز متوقع قدره {0}.",
    "Os compromissos por pagar indicados criam um défice esperado de {0}.",
    "Gli impegni non pagati indicati creano un deficit previsto di {0}.",
    "Указанные неоплаченные обязательства создают ожидаемый дефицит {0}."
  ),
  "{0} is expected to remain after the unpaid commitments shown here.": row(
    "Nach den hier gezeigten unbezahlten Verpflichtungen bleiben voraussichtlich {0} übrig.",
    "Se espera que queden {0} después de los compromisos impagados mostrados aquí.",
    "Pritet të mbeten {0} pas detyrimeve të papaguara të paraqitura këtu.",
    "من المتوقع أن يتبقى {0} بعد الالتزامات غير المدفوعة المعروضة هنا.",
    "Espera-se que restem {0} após os compromissos por pagar apresentados aqui.",
    "Si prevede che rimangano {0} dopo gli impegni non pagati mostrati qui.",
    "После показанных здесь неоплаченных обязательств ожидается остаток {0}."
  ),
  "{0} of this month's debt minimums has already been recorded and removed from Still to pay.": row(
    "{0} der Mindestzahlungen dieses Monats wurden bereits erfasst und aus „Noch zu zahlen“ entfernt.",
    "{0} de los pagos mínimos de deuda de este mes ya se ha registrado y eliminado de Pendiente de pago.",
    "{0} e pagesave minimale të borxhit të këtij muaji janë regjistruar dhe hequr nga Ende për t'u paguar.",
    "تم بالفعل تسجيل {0} من الحد الأدنى لمدفوعات الديون لهذا الشهر وإزالته من المتبقي للدفع.",
    "{0} dos mínimos de dívida deste mês já foi registado e removido de Ainda por pagar.",
    "{0} dei minimi di debito di questo mese è già stato registrato e rimosso da Ancora da pagare.",
    "{0} минимальных платежей по долгам этого месяца уже зарегистрировано и удалено из «Ещё к оплате»."
  ),
  "{0} is the largest recent spending category": row(
    "{0} ist die größte aktuelle Ausgabenkategorie",
    "{0} es la mayor categoría de gasto reciente",
    "{0} është kategoria më e madhe e shpenzimeve të fundit",
    "{0} هي أكبر فئة إنفاق حديثة",
    "{0} é a maior categoria de despesas recente",
    "{0} è la maggiore categoria di spesa recente",
    "{0} — крупнейшая категория недавних расходов"
  ),
  "{0}% of recent expense activity is concentrated in this category.": row(
    "{0}% der jüngsten Ausgaben entfallen auf diese Kategorie.",
    "El {0}% de la actividad de gastos reciente se concentra en esta categoría.",
    "{0}% e aktivitetit të fundit të shpenzimeve është përqendruar në këtë kategori.",
    "يتركز {0}% من نشاط المصروفات الأخير في هذه الفئة.",
    "{0}% da atividade de despesas recente está concentrada nesta categoria.",
    "Il {0}% dell'attività di spesa recente è concentrato in questa categoria.",
    "{0}% недавних расходов сосредоточено в этой категории."
  ),
  "The latest three-month average is {0} better than the preceding three months.": row(
    "Der Durchschnitt der letzten drei Monate ist um {0} besser als in den vorherigen drei Monaten.",
    "La media de los últimos tres meses es {0} mejor que la de los tres meses anteriores.",
    "Mesatarja e tre muajve të fundit është {0} më e mirë se tre muajt paraprakë.",
    "متوسط الأشهر الثلاثة الأخيرة أفضل بمقدار {0} من الأشهر الثلاثة السابقة.",
    "A média dos últimos três meses é {0} melhor do que a dos três meses anteriores.",
    "La media degli ultimi tre mesi è migliore di {0} rispetto ai tre mesi precedenti.",
    "Среднее за последние три месяца лучше предыдущих трёх месяцев на {0}."
  ),
  "Record approximately €{0} per month as a saving in the Emergency Fund category.": row(
    "Erfasse ungefähr {0} € pro Monat als Sparbeitrag in der Kategorie Notfallreserve.",
    "Registra aproximadamente {0} € al mes como ahorro en la categoría Fondo de emergencia.",
    "Regjistro afërsisht {0} € në muaj si kursim në kategorinë Fondi i emergjencës.",
    "سجّل نحو {0} € شهريًا كادخار ضمن فئة صندوق الطوارئ.",
    "Registe aproximadamente {0} € por mês como poupança na categoria Fundo de emergência.",
    "Registra circa {0} € al mese come risparmio nella categoria Fondo di emergenza.",
    "Записывайте примерно {0} € в месяц как сбережение в категории резервного фонда."
  ),
  "Your reserve covers {0} months against the current {1}-month recommendation.": row(
    "Deine Reserve deckt {0} Monate gegenüber der aktuellen Empfehlung von {1} Monaten ab.",
    "Tu reserva cubre {0} meses frente a la recomendación actual de {1} meses.",
    "Rezerva jote mbulon {0} muaj kundrejt rekomandimit aktual prej {1} muajsh.",
    "يغطي احتياطك {0} أشهر مقابل التوصية الحالية البالغة {1} أشهر.",
    "A sua reserva cobre {0} meses face à recomendação atual de {1} meses.",
    "La tua riserva copre {0} mesi rispetto alla raccomandazione attuale di {1} mesi.",
    "Ваш резерв покрывает {0} месяцев при текущей рекомендации {1} месяцев."
  ),
  "You currently cover {0} months of the protection baseline.": row(
    "Du deckst derzeit {0} Monate der Schutzbasis ab.",
    "Actualmente cubres {0} meses de la base de protección.",
    "Aktualisht mbulon {0} muaj të bazës së mbrojtjes.",
    "أنت تغطي حاليًا {0} أشهر من خط الحماية الأساسي.",
    "Atualmente cobre {0} meses da base de proteção.",
    "Attualmente copri {0} mesi della base di protezione.",
    "Сейчас вы покрываете {0} месяцев базового уровня защиты."
  ),
  "Your average Emergency Fund contribution over the last six months is €{0}.": row(
    "Dein durchschnittlicher Beitrag zur Notfallreserve in den letzten sechs Monaten beträgt {0} €.",
    "Tu contribución media al fondo de emergencia durante los últimos seis meses es de {0} €.",
    "Kontributi yt mesatar në fondin e emergjencës gjatë gjashtë muajve të fundit është {0} €.",
    "متوسط مساهمتك في صندوق الطوارئ خلال الأشهر الستة الماضية هو {0} €.",
    "A sua contribuição média para o fundo de emergência nos últimos seis meses é de {0} €.",
    "Il tuo contributo medio al fondo di emergenza negli ultimi sei mesi è di {0} €.",
    "Ваш средний взнос в резервный фонд за последние шесть месяцев составляет {0} €."
  ),
  "{0}-month recommendation": row(
    "Empfehlung: {0} Monate",
    "Recomendación de {0} meses",
    "Rekomandim për {0} muaj",
    "توصية لمدة {0} أشهر",
    "Recomendação de {0} meses",
    "Raccomandazione di {0} mesi",
    "Рекомендация: {0} месяцев"
  ),
  "{0} confidence": row(
    "Aussagekraft: {0}",
    "Confianza: {0}",
    "Besueshmëria: {0}",
    "الموثوقية: {0}",
    "Confiança: {0}",
    "Affidabilità: {0}",
    "Надёжность: {0}"
  ),
  "{0} of {1} financial setup areas are complete. Guidance will become more precise as the remaining areas are confirmed.": row(
    "{0} von {1} Bereichen der finanziellen Einrichtung sind abgeschlossen. Die Empfehlungen werden präziser, sobald die übrigen Bereiche bestätigt sind.",
    "Se han completado {0} de {1} áreas de configuración financiera. La orientación será más precisa a medida que se confirmen las áreas restantes.",
    "{0} nga {1} fushat e konfigurimit financiar janë përfunduar. Udhëzimi do të bëhet më i saktë kur të konfirmohen fushat e mbetura.",
    "تم إكمال {0} من أصل {1} من مجالات الإعداد المالي. ستصبح الإرشادات أكثر دقة مع تأكيد المجالات المتبقية.",
    "{0} de {1} áreas de configuração financeira estão concluídas. A orientação ficará mais precisa à medida que as restantes áreas forem confirmadas.",
    "Sono complete {0} aree di configurazione finanziaria su {1}. Le indicazioni diventeranno più precise man mano che vengono confermate le aree rimanenti.",
    "Завершено {0} из {1} областей финансовой настройки. Рекомендации станут точнее по мере подтверждения остальных областей."
  ),
  "{0} active debt account{1} currently use part of your monthly capacity.": row(
    "{0} aktive Schuldenkonten beanspruchen derzeit einen Teil deiner monatlichen Kapazität.",
    "{0} cuentas de deuda activas utilizan actualmente parte de tu capacidad mensual.",
    "{0} llogari aktive borxhi po përdorin aktualisht një pjesë të kapacitetit tënd mujor.",
    "تستخدم {0} حسابات دين نشطة حاليًا جزءًا من قدرتك الشهرية.",
    "{0} contas de dívida ativas utilizam atualmente parte da sua capacidade mensal.",
    "{0} conti di debito attivi utilizzano attualmente parte della tua capacità mensile.",
    "{0} активных долговых счетов сейчас используют часть вашей ежемесячной возможности."
  ),
  "{0}% payment-to-income": row(
    "{0}% Zahlungs-Einkommens-Verhältnis",
    "{0}% pagos sobre ingresos",
    "{0}% raport pagesa ndaj të ardhurave",
    "{0}% نسبة المدفوعات إلى الدخل",
    "{0}% pagamentos sobre rendimento",
    "{0}% rapporto pagamenti/reddito",
    "{0}% платежей к доходу"
  ),
  "{0} overdue bill{1}": row(
    "{0} überfällige Rechnungen",
    "{0} facturas vencidas",
    "{0} fatura të vonuara",
    "{0} فواتير متأخرة",
    "{0} contas vencidas",
    "{0} bollette scadute",
    "{0} просроченных счетов"
  ),
  "{0} of {1} recorded paid bills were settled by their due date.": row(
    "{0} von {1} erfassten bezahlten Rechnungen wurden bis zum Fälligkeitsdatum beglichen.",
    "{0} de {1} facturas pagadas registradas se liquidaron antes de su fecha de vencimiento.",
    "{0} nga {1} faturat e paguara të regjistruara u shlyen deri në datën e afatit.",
    "تم سداد {0} من أصل {1} من الفواتير المدفوعة المسجلة بحلول تاريخ الاستحقاق.",
    "{0} de {1} contas pagas registadas foram liquidadas até à data de vencimento.",
    "{0} delle {1} bollette pagate registrate sono state saldate entro la data di scadenza.",
    "{0} из {1} зарегистрированных оплаченных счетов были погашены к сроку."
  ),
  "{0}% funded": row(
    "{0}% finanziert",
    "{0}% financiado",
    "{0}% i financuar",
    "مموّل بنسبة {0}%",
    "{0}% financiado",
    "Finanziato al {0}%",
    "Профинансировано на {0}%"
  ),
  "{0} planned item{1}": row(
    "{0} geplante Elemente",
    "{0} elementos planificados",
    "{0} artikuj të planifikuar",
    "{0} عناصر مخططة",
    "{0} itens planeados",
    "{0} elementi pianificati",
    "{0} запланированных элементов"
  ),
  "Preliminary assessment based on {0} of 7 scoring areas. Add more financial sections to improve reliability.": row(
    "Vorläufige Bewertung auf Basis von {0} von 7 Bewertungsbereichen. Füge weitere Finanzbereiche hinzu, um die Zuverlässigkeit zu verbessern.",
    "Evaluación preliminar basada en {0} de 7 áreas de puntuación. Añade más secciones financieras para mejorar la fiabilidad.",
    "Vlerësim paraprak bazuar në {0} nga 7 fusha vlerësimi. Shto më shumë seksione financiare për të përmirësuar besueshmërinë.",
    "تقييم أولي قائم على {0} من أصل 7 مجالات تقييم. أضف المزيد من الأقسام المالية لتحسين الموثوقية.",
    "Avaliação preliminar baseada em {0} de 7 áreas de pontuação. Adicione mais secções financeiras para melhorar a fiabilidade.",
    "Valutazione preliminare basata su {0} delle 7 aree di punteggio. Aggiungi altre sezioni finanziarie per migliorare l'affidabilità.",
    "Предварительная оценка основана на {0} из 7 областей. Добавьте больше финансовых разделов для повышения надёжности."
  ),
  "{0}. {1} is currently supporting your position, while {2} offers the clearest opportunity to improve.": row(
    "{0}. {1} stützt derzeit deine Position, während {2} die klarste Verbesserungsmöglichkeit bietet.",
    "{0}. {1} está respaldando actualmente tu posición, mientras que {2} ofrece la oportunidad más clara de mejora.",
    "{0}. {1} po mbështet aktualisht pozicionin tënd, ndërsa {2} ofron mundësinë më të qartë për përmirësim.",
    "{0}. يدعم {1} وضعك حاليًا، بينما يوفر {2} أوضح فرصة للتحسين.",
    "{0}. {1} está atualmente a apoiar a sua posição, enquanto {2} oferece a oportunidade mais clara de melhoria.",
    "{0}. {1} sta attualmente sostenendo la tua posizione, mentre {2} offre l'opportunità più chiara di miglioramento.",
    "{0}. {1} сейчас поддерживает вашу позицию, а {2} даёт наиболее ясную возможность для улучшения."
  ),
  "Add {0} to make this preliminary score more reliable.": row(
    "Füge {0} hinzu, um diese vorläufige Bewertung zuverlässiger zu machen.",
    "Añade {0} para que esta puntuación preliminar sea más fiable.",
    "Shto {0} për ta bërë këtë vlerësim paraprak më të besueshëm.",
    "أضف {0} لجعل هذه الدرجة الأولية أكثر موثوقية.",
    "Adicione {0} para tornar esta pontuação preliminar mais fiável.",
    "Aggiungi {0} per rendere più affidabile questo punteggio preliminare.",
    "Добавьте {0}, чтобы сделать эту предварительную оценку надёжнее."
  ),
  "{0} months of the monthly protection baseline are currently protected.": row(
    "Derzeit sind {0} Monate der monatlichen Schutzbasis abgesichert.",
    "Actualmente están protegidos {0} meses de la base mensual de protección.",
    "Aktualisht janë të mbrojtur {0} muaj të bazës mujore të mbrojtjes.",
    "يتم حاليًا حماية {0} أشهر من خط الحماية الشهري الأساسي.",
    "Atualmente estão protegidos {0} meses da base mensal de proteção.",
    "Attualmente sono protetti {0} mesi della base mensile di protezione.",
    "Сейчас защищено {0} месяцев месячного базового уровня защиты."
  ),
  "{0}% current cash-flow margin.": row(
    "Aktuelle Cashflow-Marge: {0}%.",
    "Margen actual de flujo de caja: {0}%.",
    "Marzhi aktual i rrjedhës së parasë: {0}%.",
    "هامش التدفق النقدي الحالي: {0}%.",
    "Margem atual de fluxo de caixa: {0}%.",
    "Margine attuale del flusso di cassa: {0}%.",
    "Текущий запас денежного потока: {0}%."
  ),
  "{0}% saving consistency with {1} average monthly wealth-building pace.": row(
    "{0}% Sparbeständigkeit bei einem durchschnittlichen monatlichen Vermögensaufbautempo von {1}.",
    "{0}% de constancia de ahorro con un ritmo medio mensual de creación de patrimonio de {1}.",
    "{0}% qëndrueshmëri kursimi me ritëm mesatar mujor të ndërtimit të pasurisë prej {1}.",
    "اتساق ادخار بنسبة {0}% مع وتيرة شهرية متوسطة لبناء الثروة قدرها {1}.",
    "{0}% de consistência de poupança com um ritmo médio mensal de construção de património de {1}.",
    "{0}% di costanza nel risparmio con un ritmo medio mensile di crescita patrimoniale di {1}.",
    "Стабильность сбережений {0}% при среднем ежемесячном темпе роста капитала {1}."
  ),
  "{0} overdue bill{1} require attention.": row(
    "{0} überfällige Rechnungen erfordern Aufmerksamkeit.",
    "{0} facturas vencidas requieren atención.",
    "{0} fatura të vonuara kërkojnë vëmendje.",
    "تتطلب {0} فواتير متأخرة الانتباه.",
    "{0} contas vencidas exigem atenção.",
    "{0} bollette scadute richiedono attenzione.",
    "{0} просроченных счетов требуют внимания."
  ),
  "{0} of monthly lifestyle spending at a {1}% withdrawal assumption creates a target of {2}.": row(
    "Monatliche Lebenshaltungsausgaben von {0} ergeben bei einer Entnahmeannahme von {1}% ein Ziel von {2}.",
    "Un gasto mensual de estilo de vida de {0} con un supuesto de retirada del {1}% crea un objetivo de {2}.",
    "Shpenzimet mujore të stilit të jetesës prej {0} me supozim tërheqjeje {1}% krijojnë një objektiv prej {2}.",
    "إنفاق شهري على نمط الحياة بقيمة {0} مع افتراض سحب بنسبة {1}% ينشئ هدفًا قدره {2}.",
    "Despesas mensais de estilo de vida de {0} com um pressuposto de levantamento de {1}% criam uma meta de {2}.",
    "Una spesa mensile per lo stile di vita di {0} con un'ipotesi di prelievo del {1}% crea un obiettivo di {2}.",
    "Ежемесячные расходы на образ жизни {0} при предположении об изъятии {1}% формируют цель {2}."
  ),
  "{0} is protected as emergency reserve and excluded from investable Financial Independence capital.": row(
    "{0} sind als Notfallreserve geschützt und vom investierbaren Kapital für finanzielle Unabhängigkeit ausgeschlossen.",
    "{0} está protegido como reserva de emergencia y excluido del capital invertible para la Independencia Financiera.",
    "{0} është i mbrojtur si rezervë emergjence dhe përjashtohet nga kapitali i investueshëm për Pavarësinë Financiare.",
    "يتم حماية {0} كاحتياطي طوارئ واستبعاده من رأس المال القابل للاستثمار للاستقلال المالي.",
    "{0} está protegido como reserva de emergência e excluído do capital investível para Independência Financeira.",
    "{0} è protetto come riserva di emergenza ed escluso dal capitale investibile per l'Indipendenza Finanziaria.",
    "{0} защищено как резерв и исключено из инвестируемого капитала для финансовой независимости."
  ),
  "{0} of non-emergency savings plus {1} of average debt reduction produces a {2} monthly pace.": row(
    "{0} nicht-notfallbezogene Ersparnisse plus {1} durchschnittlicher Schuldenabbau ergeben ein monatliches Tempo von {2}.",
    "{0} de ahorros no destinados a emergencias más {1} de reducción media de deuda producen un ritmo mensual de {2}.",
    "{0} kursime jashtë emergjencës plus {1} ulje mesatare borxhi prodhojnë një ritëm mujor prej {2}.",
    "{0} من المدخرات غير المخصصة للطوارئ إضافة إلى {1} من متوسط خفض الديون ينتج وتيرة شهرية قدرها {2}.",
    "{0} de poupanças não destinadas a emergência mais {1} de redução média da dívida produzem um ritmo mensal de {2}.",
    "{0} di risparmi non destinati alle emergenze più {1} di riduzione media del debito producono un ritmo mensile di {2}.",
    "{0} неаварийных сбережений плюс {1} среднего сокращения долга дают ежемесячный темп {2}."
  ),
  "The current pace and selected real-return assumption produce an estimated {0}-month path. This is a planning estimate, not a guarantee.": row(
    "Das aktuelle Tempo und die gewählte Annahme zur realen Rendite ergeben einen geschätzten Weg von {0} Monaten. Dies ist eine Planungsschätzung, keine Garantie.",
    "El ritmo actual y el supuesto de rentabilidad real seleccionado generan una trayectoria estimada de {0} meses. Es una estimación de planificación, no una garantía.",
    "Ritmi aktual dhe supozimi i zgjedhur i kthimit real prodhojnë një rrugë të vlerësuar prej {0} muajsh. Ky është vlerësim planifikimi, jo garanci.",
    "تنتج الوتيرة الحالية وافتراض العائد الحقيقي المحدد مسارًا مقدرًا لمدة {0} أشهر. هذا تقدير للتخطيط وليس ضمانًا.",
    "O ritmo atual e o pressuposto de retorno real selecionado produzem um percurso estimado de {0} meses. Trata-se de uma estimativa de planeamento, não de uma garantia.",
    "Il ritmo attuale e l'ipotesi di rendimento reale selezionata producono un percorso stimato di {0} mesi. È una stima di pianificazione, non una garanzia.",
    "Текущий темп и выбранное предположение о реальной доходности дают оценочный путь в {0} месяцев. Это плановая оценка, а не гарантия."
  ),
  "Last {0} months": row(
    "Letzte {0} Monate",
    "Últimos {0} meses",
    "{0} muajt e fundit",
    "آخر {0} أشهر",
    "Últimos {0} meses",
    "Ultimi {0} mesi",
    "Последние {0} месяцев"
  ),
  "{0} changed the recorded net-worth position by {1}.": row(
    "{0} veränderte die erfasste Nettovermögensposition um {1}.",
    "{0} cambió la posición de patrimonio neto registrada en {1}.",
    "{0} ndryshoi pozicionin e regjistruar të pasurisë neto me {1}.",
    "غيّر {0} وضع صافي الثروة المسجل بمقدار {1}.",
    "{0} alterou a posição de património líquido registada em {1}.",
    "{0} ha modificato la posizione di patrimonio netto registrata di {1}.",
    "{0} изменил зарегистрированную позицию чистого капитала на {1}."
  ),
  "FICONTER has recorded the current net-worth position of {0}, but no comparable month-end change exists yet.": row(
    "FICONTER hat die aktuelle Nettovermögensposition von {0} erfasst, aber es gibt noch keine vergleichbare Monatsendveränderung.",
    "FICONTER ha registrado la posición actual de patrimonio neto de {0}, pero aún no existe un cambio comparable de fin de mes.",
    "FICONTER ka regjistruar pozicionin aktual të pasurisë neto prej {0}, por ende nuk ka ndryshim të krahasueshëm në fund të muajit.",
    "سجّل FICONTER وضع صافي الثروة الحالي البالغ {0}، لكن لا يوجد بعد تغيير قابل للمقارنة في نهاية الشهر.",
    "O FICONTER registou a posição atual de património líquido de {0}, mas ainda não existe uma mudança comparável de fim de mês.",
    "FICONTER ha registrato l'attuale posizione di patrimonio netto di {0}, ma non esiste ancora una variazione di fine mese confrontabile.",
    "FICONTER зарегистрировал текущую позицию чистого капитала {0}, но сопоставимого изменения на конец месяца пока нет."
  ),
  "Outstanding debt fell by {0} during the selected period.": row(
    "Die ausstehenden Schulden sanken im ausgewählten Zeitraum um {0}.",
    "La deuda pendiente disminuyó en {0} durante el período seleccionado.",
    "Borxhi i papaguar u ul me {0} gjatë periudhës së zgjedhur.",
    "انخفض الدين المستحق بمقدار {0} خلال الفترة المحددة.",
    "A dívida pendente diminuiu {0} durante o período selecionado.",
    "Il debito residuo è diminuito di {0} durante il periodo selezionato.",
    "Непогашенный долг снизился на {0} за выбранный период."
  ),
  "Outstanding debt increased by {0} during the selected period.": row(
    "Die ausstehenden Schulden stiegen im ausgewählten Zeitraum um {0}.",
    "La deuda pendiente aumentó en {0} durante el período seleccionado.",
    "Borxhi i papaguar u rrit me {0} gjatë periudhës së zgjedhur.",
    "ارتفع الدين المستحق بمقدار {0} خلال الفترة المحددة.",
    "A dívida pendente aumentou {0} durante o período selecionado.",
    "Il debito residuo è aumentato di {0} durante il periodo selezionato.",
    "Непогашенный долг увеличился на {0} за выбранный период."
  ),
  "{0} of retained capital was allocated to recorded savings. It is shown separately but never added twice to net worth.": row(
    "{0} des einbehaltenen Kapitals wurden den erfassten Ersparnissen zugeordnet. Es wird separat angezeigt, aber nie doppelt zum Nettovermögen addiert.",
    "{0} del capital retenido se asignó a ahorros registrados. Se muestra por separado, pero nunca se suma dos veces al patrimonio neto.",
    "{0} e kapitalit të mbajtur iu caktua kursimeve të regjistruara. Shfaqet veçmas, por nuk i shtohet kurrë dy herë pasurisë neto.",
    "تم تخصيص {0} من رأس المال المحتفظ به للمدخرات المسجلة. يظهر بشكل منفصل ولا يُضاف أبدًا مرتين إلى صافي الثروة.",
    "{0} do capital retido foi alocado a poupanças registadas. É apresentado separadamente, mas nunca é adicionado duas vezes ao património líquido.",
    "{0} del capitale trattenuto è stato allocato ai risparmi registrati. Viene mostrato separatamente, ma non viene mai aggiunto due volte al patrimonio netto.",
    "{0} сохранённого капитала было направлено в зарегистрированные сбережения. Оно показывается отдельно, но никогда не прибавляется к чистому капиталу дважды."
  ),
  "At the trailing completed-month pace, recorded net worth would reach approximately {0} in twelve months.": row(
    "Beim Tempo der zuletzt abgeschlossenen Monate würde das erfasste Nettovermögen in zwölf Monaten ungefähr {0} erreichen.",
    "Al ritmo de los últimos meses completados, el patrimonio neto registrado alcanzaría aproximadamente {0} en doce meses.",
    "Me ritmin e muajve të fundit të përfunduar, pasuria neto e regjistruar do të arrinte afërsisht {0} në dymbëdhjetë muaj.",
    "وفق وتيرة الأشهر المكتملة الأخيرة، سيصل صافي الثروة المسجل إلى نحو {0} خلال اثني عشر شهرًا.",
    "Ao ritmo dos últimos meses concluídos, o património líquido registado atingiria aproximadamente {0} em doze meses.",
    "Al ritmo degli ultimi mesi completati, il patrimonio netto registrato raggiungerebbe circa {0} in dodici mesi.",
    "При темпе последних завершённых месяцев зарегистрированный чистый капитал достиг бы примерно {0} за двенадцать месяцев."
  ),
  "FICONTER has {0} of the 3 completed month-to-month changes required for a responsible outlook.": row(
    "FICONTER verfügt über {0} der 3 abgeschlossenen Monatsveränderungen, die für eine verantwortungsvolle Prognose erforderlich sind.",
    "FICONTER dispone de {0} de los 3 cambios completos de un mes a otro necesarios para una previsión responsable.",
    "FICONTER ka {0} nga 3 ndryshimet e përfunduara nga muaji në muaj të nevojshme për një parashikim të përgjegjshëm.",
    "لدى FICONTER عدد {0} من أصل 3 تغييرات مكتملة من شهر إلى آخر مطلوبة لتوقع مسؤول.",
    "O FICONTER tem {0} das 3 mudanças concluídas mês a mês necessárias para uma perspetiva responsável.",
    "FICONTER dispone di {0} delle 3 variazioni complete mese su mese necessarie per una previsione responsabile.",
    "У FICONTER есть {0} из 3 завершённых изменений от месяца к месяцу, необходимых для ответственного прогноза."
  ),
  "The six-month calendar average is €{0} per month, leaving a €{1} monthly gap.": row(
    "Der Sechsmonats-Kalenderdurchschnitt beträgt {0} € pro Monat, wodurch eine monatliche Lücke von {1} € bleibt.",
    "La media de seis meses es de {0} € al mes, dejando una brecha mensual de {1} €.",
    "Mesatarja kalendarike gjashtëmujore është {0} € në muaj, duke lënë një hendek mujor prej {1} €.",
    "متوسط الستة أشهر هو {0} € شهريًا، مما يترك فجوة شهرية قدرها {1} €.",
    "A média de seis meses é de {0} € por mês, deixando uma diferença mensal de {1} €.",
    "La media di sei mesi è di {0} € al mese, lasciando un divario mensile di {1} €.",
    "Среднее за шесть месяцев составляет {0} € в месяц, оставляя месячный разрыв {1} €."
  ),
  "The current pace is {0}% of the sustainable monthly target.": row(
    "Das aktuelle Tempo entspricht {0}% des nachhaltigen Monatsziels.",
    "El ritmo actual es el {0}% del objetivo mensual sostenible.",
    "Ritmi aktual është {0}% e objektivit mujor të qëndrueshëm.",
    "الوتيرة الحالية تساوي {0}% من الهدف الشهري المستدام.",
    "O ritmo atual corresponde a {0}% do objetivo mensal sustentável.",
    "Il ritmo attuale è pari al {0}% dell'obiettivo mensile sostenibile.",
    "Текущий темп составляет {0}% устойчивой месячной цели."
  ),
  "Savings were recorded in {0} of {1} active months.": row(
    "In {0} von {1} aktiven Monaten wurden Ersparnisse erfasst.",
    "Se registraron ahorros en {0} de {1} meses activos.",
    "Kursime u regjistruan në {0} nga {1} muaj aktivë.",
    "تم تسجيل مدخرات في {0} من أصل {1} أشهر نشطة.",
    "Foram registadas poupanças em {0} de {1} meses ativos.",
    "Sono stati registrati risparmi in {0} dei {1} mesi attivi.",
    "Сбережения были зарегистрированы в {0} из {1} активных месяцев."
  ),
  "Savings were recorded in {0}% of active months.": row(
    "In {0}% der aktiven Monate wurden Ersparnisse erfasst.",
    "Se registraron ahorros en el {0}% de los meses activos.",
    "Kursime u regjistruan në {0}% të muajve aktivë.",
    "تم تسجيل مدخرات في {0}% من الأشهر النشطة.",
    "Foram registadas poupanças em {0}% dos meses ativos.",
    "Sono stati registrati risparmi nel {0}% dei mesi attivi.",
    "Сбережения были зарегистрированы в {0}% активных месяцев."
  ),
  "The latest three-month average is €{0} lower than the preceding three months.": row(
    "Der Durchschnitt der letzten drei Monate liegt {0} € unter den vorherigen drei Monaten.",
    "La media de los últimos tres meses es {0} € inferior a la de los tres meses anteriores.",
    "Mesatarja e tre muajve të fundit është {0} € më e ulët se tre muajt paraprakë.",
    "متوسط الأشهر الثلاثة الأخيرة أقل بمقدار {0} € من الأشهر الثلاثة السابقة.",
    "A média dos últimos três meses é {0} € inferior à dos três meses anteriores.",
    "La media degli ultimi tre mesi è inferiore di {0} € rispetto ai tre mesi precedenti.",
    "Среднее за последние три месяца ниже предыдущих трёх месяцев на {0} €."
  ),
  "The latest three-month average is €{0} higher than the preceding three months.": row(
    "Der Durchschnitt der letzten drei Monate liegt {0} € über den vorherigen drei Monaten.",
    "La media de los últimos tres meses es {0} € superior a la de los tres meses anteriores.",
    "Mesatarja e tre muajve të fundit është {0} € më e lartë se tre muajt paraprakë.",
    "متوسط الأشهر الثلاثة الأخيرة أعلى بمقدار {0} € من الأشهر الثلاثة السابقة.",
    "A média dos últimos três meses é {0} € superior à dos três meses anteriores.",
    "La media degli ultimi tre mesi è superiore di {0} € rispetto ai tre mesi precedenti.",
    "Среднее за последние три месяца выше предыдущих трёх месяцев на {0} €."
  ),
  "Most savings are concentrated in {0}": row(
    "Der größte Teil der Ersparnisse ist in {0} konzentriert",
    "La mayor parte de los ahorros se concentra en {0}",
    "Shumica e kursimeve është përqendruar në {0}",
    "تتركز معظم المدخرات في {0}",
    "A maior parte das poupanças está concentrada em {0}",
    "La maggior parte dei risparmi è concentrata in {0}",
    "Большая часть сбережений сосредоточена в {0}"
  ),
  "{0}% of recorded savings is assigned to this category.": row(
    "{0}% der erfassten Ersparnisse sind dieser Kategorie zugeordnet.",
    "El {0}% de los ahorros registrados está asignado a esta categoría.",
    "{0}% e kursimeve të regjistruara i është caktuar kësaj kategorie.",
    "تم تخصيص {0}% من المدخرات المسجلة لهذه الفئة.",
    "{0}% das poupanças registadas está atribuído a esta categoria.",
    "Il {0}% dei risparmi registrati è assegnato a questa categoria.",
    "{0}% зарегистрированных сбережений отнесено к этой категории."
  ),
  "{0}% recent retention": row(
    "{0}% jüngste Bindung",
    "{0}% de retención reciente",
    "{0}% mbajtje e fundit",
    "{0}% احتفاظ حديث",
    "{0}% retenção recente",
    "{0}% retention recente",
    "{0}% недавнего удержания"
  ),
  "{0} months of income": row(
    "{0} Monate Einkommen",
    "{0} meses de ingresos",
    "{0} muaj të ardhura",
    "{0} أشهر من الدخل",
    "{0} meses de rendimento",
    "{0} mesi di reddito",
    "{0} месяцев дохода"
  ),
  "{0}% repaid": row(
    "{0}% zurückgezahlt",
    "{0}% reembolsado",
    "{0}% i shlyer",
    "تم سداد {0}%",
    "{0}% reembolsado",
    "{0}% rimborsato",
    "Погашено {0}%"
  ),
  "{0}× recorded capital": row(
    "{0}× erfasstes Kapital",
    "{0}× capital registrado",
    "{0}× kapital i regjistruar",
    "{0}× رأس المال المسجل",
    "{0}× capital registado",
    "{0}× capitale registrato",
    "{0}× зарегистрированный капитал"
  ),
  "Preliminary assessment based on {0} of 7 wealth factors. More history and balance-sheet detail will improve reliability.": row(
    "Vorläufige Bewertung auf Basis von {0} von 7 Vermögensfaktoren. Mehr Historie und Bilanzdetails verbessern die Zuverlässigkeit.",
    "Evaluación preliminar basada en {0} de 7 factores patrimoniales. Más historial y detalle del balance mejorarán la fiabilidad.",
    "Vlerësim paraprak bazuar në {0} nga 7 faktorë të pasurisë. Më shumë histori dhe detaje të bilancit do të përmirësojnë besueshmërinë.",
    "تقييم أولي قائم على {0} من أصل 7 عوامل للثروة. سيحسن المزيد من السجل وتفاصيل الميزانية الموثوقية.",
    "Avaliação preliminar baseada em {0} de 7 fatores patrimoniais. Mais histórico e detalhe do balanço melhorarão a fiabilidade.",
    "Valutazione preliminare basata su {0} dei 7 fattori patrimoniali. Più storico e dettagli di bilancio miglioreranno l'affidabilità.",
    "Предварительная оценка основана на {0} из 7 факторов капитала. Более длинная история и детали баланса повысят надёжность."
  ),
  "{0}. {1} currently supports your trajectory, while {2} is the clearest opportunity to strengthen long-term wealth.": row(
    "{0}. {1} unterstützt derzeit deine Entwicklung, während {2} die klarste Möglichkeit bietet, das langfristige Vermögen zu stärken.",
    "{0}. {1} respalda actualmente tu trayectoria, mientras que {2} es la oportunidad más clara para fortalecer el patrimonio a largo plazo.",
    "{0}. {1} po mbështet aktualisht trajektoren tënde, ndërsa {2} është mundësia më e qartë për të forcuar pasurinë afatgjatë.",
    "{0}. يدعم {1} مسارك حاليًا، بينما يمثل {2} أوضح فرصة لتعزيز الثروة على المدى الطويل.",
    "{0}. {1} apoia atualmente a sua trajetória, enquanto {2} é a oportunidade mais clara para reforçar o património a longo prazo.",
    "{0}. {1} sostiene attualmente la tua traiettoria, mentre {2} è l'opportunità più chiara per rafforzare il patrimonio a lungo termine.",
    "{0}. {1} сейчас поддерживает вашу траекторию, а {2} — наиболее ясная возможность укрепить долгосрочный капитал."
  ),
  "{0} months": row("{0} Monate", "{0} meses", "{0} muaj", "{0} أشهر", "{0} meses", "{0} mesi", "{0} месяцев"),
  "{0} month": row("{0} Monat", "{0} mes", "{0} muaj", "{0} شهر", "{0} mês", "{0} mese", "{0} месяц"),
  "{0} remaining": row("{0} verbleibend", "{0} restantes", "{0} të mbetura", "متبقي {0}", "{0} restantes", "{0} rimanenti", "Осталось {0}"),
  "Financial GPS is {0}": row("Finanz-GPS ist {0}", "El GPS financiero está {0}", "GPS-i Financiar është {0}", "نظام التوجيه المالي هو {0}", "O GPS Financeiro está {0}", "Il GPS Finanziario è {0}", "Финансовый GPS: {0}"),
  "Wealth score {0} out of 100": row("Vermögensscore {0} von 100", "Puntuación patrimonial {0} de 100", "Rezultati i pasurisë {0} nga 100", "درجة الثروة {0} من 100", "Pontuação patrimonial {0} de 100", "Punteggio patrimoniale {0} su 100", "Оценка капитала {0} из 100"),
  "Financial health score {0} out of 100": row("Finanzgesundheitsscore {0} von 100", "Puntuación de salud financiera {0} de 100", "Rezultati i shëndetit financiar {0} nga 100", "درجة الصحة المالية {0} من 100", "Pontuação de saúde financeira {0} de 100", "Punteggio di salute finanziaria {0} su 100", "Оценка финансового здоровья {0} из 100")
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileTemplate(template: string): RegExp {
  let pattern = "^";
  let cursor = 0;
  const matcher = /\{(\d+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(template))) {
    pattern += escapeRegex(template.slice(cursor, match.index));
    pattern += "(.+?)";
    cursor = match.index + match[0].length;
  }
  pattern += escapeRegex(template.slice(cursor));
  pattern += "$";
  return new RegExp(pattern, "u");
}

const COMPILED = Object.entries(WEALTH_RUNTIME_TEMPLATES).map(
  ([source, translations]) => ({ source, translations, regex: compileTemplate(source) }),
);

export function translateWealthTemplate(
  language: FiconterLanguage,
  source: string,
  translateToken: (value: string) => string,
): string | null {
  if (language === "en") return source;

  for (const entry of COMPILED) {
    const match = source.match(entry.regex);
    if (!match) continue;

    const target = entry.translations[language];
    return target.replace(/\{(\d+)\}/g, (_, rawIndex: string) => {
      const index = Number(rawIndex) + 1;
      const value = match[index] ?? "";
      return translateToken(value);
    });
  }

  return null;
}
