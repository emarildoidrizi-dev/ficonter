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

export const GLOBAL_RUNTIME_TEMPLATES: Record<string, TemplateRow> = {
  "A new reply is available for {0}.": row("Für {0} ist eine neue Antwort verfügbar.", "Hay una nueva respuesta disponible para {0}.", "Një përgjigje e re është e disponueshme për {0}.", "يتوفر رد جديد لـ {0}.", "Está disponível uma nova resposta para {0}.", "È disponibile una nuova risposta per {0}.", "Для {0} доступен новый ответ."),
  "{0} is now {1}.": row("{0} ist jetzt {1}.", "{0} ahora es {1}.", "{0} tani është {1}.", "{0} أصبح الآن {1}.", "{0} agora é {1}.", "{0} ora è {1}.", "{0} теперь {1}."),
  "Suspend {0}?": row("{0} sperren?", "¿Suspender a {0}?", "Të pezullohet {0}?", "تعليق {0}؟", "Suspender {0}?", "Sospendere {0}?", "Приостановить {0}?"),
  "Restore {0}?": row("{0} wiederherstellen?", "¿Restaurar a {0}?", "Të rikthehet {0}?", "استعادة {0}؟", "Restaurar {0}?", "Ripristinare {0}?", "Восстановить {0}?"),
  "Make {0} an admin?": row("{0} zum Admin machen?", "¿Convertir a {0} en administrador?", "Të bëhet {0} administrator?", "تعيين {0} كمسؤول؟", "Tornar {0} administrador?", "Rendere {0} amministratore?", "Сделать {0} администратором?"),
  "{0} will immediately lose access to the administration area but will remain an active registered FICONTER user.": row("{0} verliert sofort den Zugriff auf den Administrationsbereich, bleibt aber ein aktiver registrierter FICONTER-Nutzer.", "{0} perderá inmediatamente el acceso al área de administración, pero seguirá siendo un usuario registrado activo de FICONTER.", "{0} do të humbasë menjëherë qasjen në zonën e administrimit, por do të mbetet përdorues aktiv i regjistruar i FICONTER.", "سيفقد {0} فورًا الوصول إلى منطقة الإدارة، لكنه سيظل مستخدمًا نشطًا ومسجلًا في FICONTER.", "{0} perderá imediatamente o acesso à área de administração, mas continuará a ser um utilizador FICONTER registado e ativo.", "{0} perderà immediatamente l'accesso all'area amministrativa, ma resterà un utente FICONTER registrato e attivo.", "{0} немедленно потеряет доступ к административной области, но останется активным зарегистрированным пользователем FICONTER."),
  "Make {0} a Super Admin?": row("{0} zum Super Admin machen?", "¿Convertir a {0} en Super Admin?", "Të bëhet {0} Super Admin?", "تعيين {0} كمسؤول أعلى؟", "Tornar {0} Super Admin?", "Rendere {0} Super Admin?", "Сделать {0} суперадминистратором?"),
  "Demote {0} to Admin?": row("{0} auf Admin herabstufen?", "¿Degradar a {0} a Admin?", "Të ulet {0} në Admin?", "خفض {0} إلى مسؤول؟", "Rebaixar {0} para Admin?", "Declassare {0} ad Admin?", "Понизить {0} до администратора?"),
  "Revoke Beta access for {0}?": row("Beta-Zugang für {0} entziehen?", "¿Revocar el acceso Beta de {0}?", "T'i hiqet qasja Beta {0}?", "إلغاء وصول Beta لـ {0}؟", "Revogar o acesso Beta de {0}?", "Revocare l'accesso Beta per {0}?", "Отозвать Beta-доступ у {0}?"),
  "Permanently delete {0}?": row("{0} dauerhaft löschen?", "¿Eliminar permanentemente a {0}?", "Të fshihet përgjithmonë {0}?", "حذف {0} نهائيًا؟", "Eliminar permanentemente {0}?", "Eliminare definitivamente {0}?", "Удалить {0} навсегда?"),
  "{0} ms": row("{0} ms", "{0} ms", "{0} ms", "{0} مللي ثانية", "{0} ms", "{0} ms", "{0} мс"),
  "{0}% report-data readiness": row("{0}% Berichtsdaten-Bereitschaft", "{0}% de preparación de datos del informe", "{0}% gatishmëri e të dhënave të raportit", "جاهزية بيانات التقرير {0}%", "{0}% de prontidão dos dados do relatório", "{0}% di completezza dei dati del rapporto", "Готовность данных отчёта: {0}%"),
  "Automatic at {0} · {1}": row("Automatisch um {0} · {1}", "Automático a las {0} · {1}", "Automatikisht në {0} · {1}", "تلقائي عند {0} · {1}", "Automático às {0} · {1}", "Automatico alle {0} · {1}", "Автоматически в {0} · {1}"),
  "Expired {0}": row("Abgelaufen {0}", "Caducó {0}", "Skadoi {0}", "انتهت الصلاحية {0}", "Expirou {0}", "Scaduto {0}", "Истёк {0}"),
  "Expires in {0} days": row("Läuft in {0} Tagen ab", "Caduca en {0} días", "Skadon pas {0} ditësh", "تنتهي الصلاحية خلال {0} أيام", "Expira em {0} dias", "Scade tra {0} giorni", "Истекает через {0} дней"),
  "The {0} image must be {1} or smaller.": row("Das Bild {0} muss {1} oder kleiner sein.", "La imagen {0} debe tener {1} o menos.", "Imazhi {0} duhet të jetë {1} ose më i vogël.", "يجب أن تكون صورة {0} بحجم {1} أو أقل.", "A imagem {0} deve ter {1} ou menos.", "L'immagine {0} deve essere di {1} o inferiore.", "Изображение {0} должно быть размером {1} или меньше."),
  "Budget saved for {0}.": row("Budget für {0} gespeichert.", "Presupuesto guardado para {0}.", "Buxheti u ruajt për {0}.", "تم حفظ الميزانية لـ {0}.", "Orçamento guardado para {0}.", "Budget salvato per {0}.", "Бюджет для {0} сохранён."),
  "{0} deleted.": row("{0} gelöscht.", "{0} eliminado.", "{0} u fshi.", "تم حذف {0}.", "{0} eliminado.", "{0} eliminato.", "{0} удалён."),
  "{0}% contribution margin": row("{0}% Deckungsbeitrag", "{0}% margen de contribución", "{0}% marzh kontributi", "هامش مساهمة {0}%", "{0}% margem de contribuição", "{0}% margine di contribuzione", "Маржа вклада: {0}%"),
  "Edit {0}": row("{0} bearbeiten", "Editar {0}", "Ndrysho {0}", "تعديل {0}", "Editar {0}", "Modifica {0}", "Изменить {0}"),
  "Delete {0}": row("{0} löschen", "Eliminar {0}", "Fshi {0}", "حذف {0}", "Eliminar {0}", "Elimina {0}", "Удалить {0}"),
  "Archive {0}": row("{0} archivieren", "Archivar {0}", "Arkivo {0}", "أرشفة {0}", "Arquivar {0}", "Archivia {0}", "Архивировать {0}"),
  "Reactivate {0}": row("{0} reaktivieren", "Reactivar {0}", "Riaktivizo {0}", "إعادة تنشيط {0}", "Reativar {0}", "Riattiva {0}", "Повторно активировать {0}"),
  "Open {0} business": row("Unternehmen {0} öffnen", "Abrir empresa {0}", "Hap biznesin {0}", "فتح نشاط {0}", "Abrir negócio {0}", "Apri azienda {0}", "Открыть бизнес {0}"),
  "{0} cover": row("Titelbild von {0}", "Portada de {0}", "Kopertina e {0}", "غلاف {0}", "Capa de {0}", "Copertina di {0}", "Обложка {0}"),
  "{0} logo": row("Logo von {0}", "Logotipo de {0}", "Logoja e {0}", "شعار {0}", "Logótipo de {0}", "Logo di {0}", "Логотип {0}"),
  "Operating income {0}": row("Betriebsergebnis {0}", "Resultado operativo {0}", "Të ardhura operative {0}", "الدخل التشغيلي {0}", "Resultado operacional {0}", "Risultato operativo {0}", "Операционная прибыль {0}"),
  "Gross profit {0}": row("Bruttogewinn {0}", "Beneficio bruto {0}", "Fitimi bruto {0}", "إجمالي الربح {0}", "Lucro bruto {0}", "Utile lordo {0}", "Валовая прибыль {0}"),
  "Operating profit {0}": row("Betriebsgewinn {0}", "Beneficio operativo {0}", "Fitimi operativ {0}", "الربح التشغيلي {0}", "Lucro operacional {0}", "Utile operativo {0}", "Операционная прибыль {0}"),
  "Correct {0}": row("{0} korrigieren", "Corregir {0}", "Korrigjo {0}", "تصحيح {0}", "Corrigir {0}", "Correggi {0}", "Исправить {0}"),
  "· {0} cost": row("· Kosten {0}", "· coste {0}", "· kosto {0}", "· تكلفة {0}", "· custo {0}", "· costo {0}", "· стоимость {0}"),
  "Income {0}": row("Einnahmen {0}", "Ingresos {0}", "Të ardhura {0}", "الدخل {0}", "Rendimentos {0}", "Entrate {0}", "Доходы {0}"),
  "Outflow {0}": row("Ausgaben {0}", "Salidas {0}", "Dalje {0}", "المصروفات {0}", "Saídas {0}", "Uscite {0}", "Расходы {0}"),
  "{0}{1}% vs prior 90 days": row("{0}{1}% gegenüber den vorherigen 90 Tagen", "{0}{1}% frente a los 90 días anteriores", "{0}{1}% kundrejt 90 ditëve paraprake", "{0}{1}% مقارنة بالتسعين يومًا السابقة", "{0}{1}% face aos 90 dias anteriores", "{0}{1}% rispetto ai 90 giorni precedenti", "{0}{1}% к предыдущим 90 дням"),
  "Automatic 3% · {0} still to pay · {1}": row("Automatisch 3% · {0} noch zu zahlen · {1}", "Automático 3% · {0} pendiente · {1}", "Automatikisht 3% · {0} ende për t'u paguar · {1}", "تلقائي 3% · {0} متبقي للدفع · {1}", "Automático 3% · {0} ainda por pagar · {1}", "Automatico 3% · {0} ancora da pagare · {1}", "Автоматически 3% · {0} ещё к оплате · {1}"),
  "Delete {0}?": row("{0} löschen?", "¿Eliminar {0}?", "Të fshihet {0}?", "حذف {0}؟", "Eliminar {0}?", "Eliminare {0}?", "Удалить {0}?"),
  "Will not renew · Paid access until {0}": row("Wird nicht verlängert · Bezahlter Zugang bis {0}", "No se renovará · Acceso de pago hasta {0}", "Nuk rinovohet · Qasje me pagesë deri më {0}", "لن يتجدد · الوصول المدفوع حتى {0}", "Não será renovado · Acesso pago até {0}", "Non si rinnoverà · Accesso a pagamento fino al {0}", "Не продлевается · Платный доступ до {0}"),
  "Active · Next billing date {0}": row("Aktiv · Nächstes Abrechnungsdatum {0}", "Activo · Próxima fecha de facturación {0}", "Aktiv · Data e ardhshme e faturimit {0}", "نشط · تاريخ الفوترة التالي {0}", "Ativo · Próxima data de faturação {0}", "Attivo · Prossima data di fatturazione {0}", "Активно · Следующая дата списания {0}"),
  "You will keep your paid plan access until {0}.": row("Du behältst deinen bezahlten Tarifzugang bis {0}.", "Mantendrás el acceso a tu plan de pago hasta {0}.", "Do ta mbash qasjen në planin me pagesë deri më {0}.", "ستحتفظ بالوصول إلى خطتك المدفوعة حتى {0}.", "Manterá o acesso ao plano pago até {0}.", "Manterrai l'accesso al piano a pagamento fino al {0}.", "Вы сохраните доступ к платному плану до {0}."),
  "Debt and {0} linked {1} deleted.": row("Schuld und {0} verknüpfte {1} gelöscht.", "Deuda y {0} {1} vinculados eliminados.", "Borxhi dhe {0} {1} të lidhura u fshinë.", "تم حذف الدين و{0} من {1} المرتبطة.", "Dívida e {0} {1} associados eliminados.", "Debito e {0} {1} collegati eliminati.", "Долг и {0} связанных {1} удалены."),
  "· {0} minimum due": row("· {0} Mindestzahlung fällig", "· {0} mínimo pendiente", "· {0} minimum për t'u paguar", "· الحد الأدنى المستحق {0}", "· {0} mínimo devido", "· {0} minimo dovuto", "· минимальный платёж {0}"),
  "Due day {0}": row("Fälligkeitstag {0}", "Día de vencimiento {0}", "Dita e afatit {0}", "يوم الاستحقاق {0}", "Dia de vencimento {0}", "Giorno di scadenza {0}", "День оплаты {0}"),
  "{0} was permanently deleted.": row("{0} wurde dauerhaft gelöscht.", "{0} se eliminó permanentemente.", "{0} u fshi përgjithmonë.", "تم حذف {0} نهائيًا.", "{0} foi eliminado permanentemente.", "{0} è stato eliminato definitivamente.", "{0} удалён навсегда."),
  "{0}% of storage used": row("{0}% des Speichers verwendet", "{0}% del almacenamiento utilizado", "{0}% e hapësirës u përdor", "تم استخدام {0}% من مساحة التخزين", "{0}% do armazenamento utilizado", "{0}% dello spazio utilizzato", "Использовано {0}% хранилища"),
  "{0} was saved privately.": row("{0} wurde privat gespeichert.", "{0} se guardó de forma privada.", "{0} u ruajt privatisht.", "تم حفظ {0} بشكل خاص.", "{0} foi guardado de forma privada.", "{0} è stato salvato privatamente.", "{0} сохранён приватно."),
  "{0} was updated.": row("{0} wurde aktualisiert.", "{0} se actualizó.", "{0} u përditësua.", "تم تحديث {0}.", "{0} foi atualizado.", "{0} è stato aggiornato.", "{0} обновлён."),
  "{0} entry is now active.": row("Der Eintrag {0} ist jetzt aktiv.", "La entrada {0} está ahora activa.", "Regjistrimi {0} tani është aktiv.", "الإدخال {0} نشط الآن.", "A entrada {0} está agora ativa.", "La voce {0} è ora attiva.", "Запись {0} теперь активна."),
  "{0} is ready to review.": row("{0} ist bereit zur Prüfung.", "{0} está listo para revisar.", "{0} është gati për rishikim.", "{0} جاهز للمراجعة.", "{0} está pronto para revisão.", "{0} è pronto per la revisione.", "{0} готово к проверке."),
  "{0} was added for this month.": row("{0} wurde für diesen Monat hinzugefügt.", "{0} se añadió para este mes.", "{0} u shtua për këtë muaj.", "تمت إضافة {0} لهذا الشهر.", "{0} foi adicionado para este mês.", "{0} è stato aggiunto per questo mese.", "{0} добавлено на этот месяц."),
  "{0} recurring entries were confirmed.": row("{0} wiederkehrende Einträge wurden bestätigt.", "Se confirmaron {0} entradas recurrentes.", "U konfirmuan {0} regjistrime të përsëritura.", "تم تأكيد {0} إدخالات متكررة.", "Foram confirmadas {0} entradas recorrentes.", "Sono state confermate {0} voci ricorrenti.", "Подтверждено {0} повторяющихся записей."),
  "Remove {0} shortcut": row("Verknüpfung {0} entfernen", "Eliminar acceso directo {0}", "Hiq shkurtoren {0}", "إزالة اختصار {0}", "Remover atalho {0}", "Rimuovi scorciatoia {0}", "Удалить ярлык {0}"),
  "{0} app navigation": row("App-Navigation {0}", "Navegación de la app {0}", "Navigimi i aplikacionit {0}", "تنقل التطبيق {0}", "Navegação da app {0}", "Navigazione app {0}", "Навигация приложения {0}"),
  "{0} — upgrade required": row("{0} — Upgrade erforderlich", "{0} — se requiere mejora de plan", "{0} — kërkohet përmirësim i planit", "{0} — يلزم الترقية", "{0} — é necessário atualizar o plano", "{0} — è richiesto un upgrade", "{0} — требуется повышение тарифа"),
  "Recorded capital exceeds liabilities by {0}.": row("Das erfasste Kapital übersteigt die Verbindlichkeiten um {0}.", "El capital registrado supera los pasivos en {0}.", "Kapitali i regjistruar tejkalon detyrimet me {0}.", "يتجاوز رأس المال المسجل الالتزامات بمقدار {0}.", "O capital registado excede os passivos em {0}.", "Il capitale registrato supera le passività di {0}.", "Зарегистрированный капитал превышает обязательства на {0}."),
  "Recorded liabilities currently exceed capital by {0}.": row("Die erfassten Verbindlichkeiten übersteigen das Kapital derzeit um {0}.", "Los pasivos registrados superan actualmente el capital en {0}.", "Detyrimet e regjistruara aktualisht tejkalojnë kapitalin me {0}.", "تتجاوز الالتزامات المسجلة حاليًا رأس المال بمقدار {0}.", "Os passivos registados excedem atualmente o capital em {0}.", "Le passività registrate superano attualmente il capitale di {0}.", "Зарегистрированные обязательства сейчас превышают капитал на {0}."),
  "{0} months of the selected lifestyle need are protected.": row("{0} Monate des gewählten Lebensbedarfs sind abgesichert.", "Están protegidos {0} meses de la necesidad de estilo de vida seleccionada.", "Janë të mbrojtur {0} muaj të nevojës së zgjedhur të stilit të jetesës.", "تمت حماية {0} أشهر من احتياج نمط الحياة المحدد.", "Estão protegidos {0} meses da necessidade de estilo de vida selecionada.", "Sono protetti {0} mesi del fabbisogno di stile di vita selezionato.", "Защищено {0} месяцев выбранной потребности образа жизни."),
  "{0}% average recorded cash-flow margin.": row("Durchschnittlich erfasste Cashflow-Marge: {0}%.", "Margen medio registrado de flujo de caja: {0}%.", "Marzhi mesatar i regjistruar i rrjedhës së parasë: {0}%.", "متوسط هامش التدفق النقدي المسجل: {0}%.", "Margem média registada de fluxo de caixa: {0}%.", "Margine medio registrato del flusso di cassa: {0}%.", "Средний зарегистрированный запас денежного потока: {0}%."),
  "{0} of the last {1} recorded months included a contribution; current six-month pace is {2} per month.": row("In {0} der letzten {1} erfassten Monate gab es einen Beitrag; das aktuelle Sechsmonatstempo beträgt {2} pro Monat.", "En {0} de los últimos {1} meses registrados hubo una contribución; el ritmo actual de seis meses es de {2} al mes.", "Në {0} nga {1} muajt e fundit të regjistruar kishte kontribut; ritmi aktual gjashtëmujor është {2} në muaj.", "تضمنت {0} من آخر {1} أشهر مسجلة مساهمة؛ والوتيرة الحالية لستة أشهر هي {2} شهريًا.", "Em {0} dos últimos {1} meses registados houve uma contribuição; o ritmo atual de seis meses é de {2} por mês.", "In {0} degli ultimi {1} mesi registrati è stato effettuato un contributo; il ritmo attuale di sei mesi è {2} al mese.", "В {0} из последних {1} зарегистрированных месяцев был взнос; текущий шестимесячный темп — {2} в месяц."),
  "{0} recorded {1} overdue.": row("{0} erfasste {1} sind überfällig.", "{0} {1} registrados están vencidos.", "{0} {1} të regjistruara janë të vonuara.", "هناك {0} من {1} المسجلة متأخرة.", "{0} {1} registados estão em atraso.", "{0} {1} registrati sono scaduti.", "{0} зарегистрированных {1} просрочены."),
  "About {0} years": row("Etwa {0} Jahre", "Aproximadamente {0} años", "Rreth {0} vite", "حوالي {0} سنوات", "Cerca de {0} anos", "Circa {0} anni", "Около {0} лет"),
  "· {0} confirmed as currently zero": row("· {0} derzeit als null bestätigt", "· {0} confirmado actualmente como cero", "· {0} konfirmuar aktualisht si zero", "· تم تأكيد {0} حاليًا على أنه صفر", "· {0} atualmente confirmado como zero", "· {0} attualmente confermato come zero", "· {0} сейчас подтверждено как ноль"),
  "Next step: {0}": row("Nächster Schritt: {0}", "Siguiente paso: {0}", "Hapi tjetër: {0}", "الخطوة التالية: {0}", "Próximo passo: {0}", "Prossimo passo: {0}", "Следующий шаг: {0}"),
  "{0} percent complete": row("{0} Prozent abgeschlossen", "{0} por ciento completado", "{0} përqind e përfunduar", "مكتمل بنسبة {0} بالمئة", "{0} por cento concluído", "{0} per cento completato", "Завершено на {0} процентов"),
  "{0}% through the FICONTER financial journey": row("{0}% der finanziellen FICONTER-Reise abgeschlossen", "{0}% del recorrido financiero de FICONTER completado", "{0}% e rrugëtimit financiar FICONTER i përfunduar", "تم إكمال {0}% من رحلة FICONTER المالية", "{0}% do percurso financeiro FICONTER concluído", "{0}% del percorso finanziario FICONTER completato", "Пройдено {0}% финансового пути FICONTER"),
  "{0} net worth, capital and liability trend": row("{0} Trend von Nettovermögen, Kapital und Verbindlichkeiten", "{0} tendencia de patrimonio neto, capital y pasivos", "{0} trend i pasurisë neto, kapitalit dhe detyrimeve", "{0} اتجاه صافي الثروة ورأس المال والالتزامات", "{0} tendência de património líquido, capital e passivos", "{0} tendenza di patrimonio netto, capitale e passività", "{0} тренд чистого капитала, капитала и обязательств"),
  "{0} unread": row("{0} ungelesen", "{0} sin leer", "{0} të palexuara", "{0} غير مقروءة", "{0} não lidas", "{0} non lette", "{0} непрочитанных"),
  "{0} mobile app navigation": row("Mobile App-Navigation {0}", "Navegación de la app móvil {0}", "Navigimi i aplikacionit celular {0}", "تنقل تطبيق الهاتف {0}", "Navegação da app móvel {0}", "Navigazione app mobile {0}", "Навигация мобильного приложения {0}"),
  "· {0} owned": row("· {0} im Besitz", "· {0} en propiedad", "· {0} në pronësi", "· {0} مملوكة", "· {0} detidos", "· {0} posseduti", "· {0} в собственности"),
  "EUR equivalent: {0} · 1 {1} = {2} EUR": row("EUR-Gegenwert: {0} · 1 {1} = {2} EUR", "Equivalente en EUR: {0} · 1 {1} = {2} EUR", "Ekuivalenti në EUR: {0} · 1 {1} = {2} EUR", "المعادل باليورو: {0} · 1 {1} = {2} EUR", "Equivalente em EUR: {0} · 1 {1} = {2} EUR", "Equivalente in EUR: {0} · 1 {1} = {2} EUR", "Эквивалент в EUR: {0} · 1 {1} = {2} EUR"),
  "Your plan will not renew. Paid access remains active until {0}.": row("Dein Tarif wird nicht verlängert. Der bezahlte Zugang bleibt bis {0} aktiv.", "Tu plan no se renovará. El acceso de pago seguirá activo hasta {0}.", "Plani yt nuk do të rinovohet. Qasja me pagesë mbetet aktive deri më {0}.", "لن يتم تجديد خطتك. سيظل الوصول المدفوع نشطًا حتى {0}.", "O seu plano não será renovado. O acesso pago permanece ativo até {0}.", "Il tuo piano non si rinnoverà. L'accesso a pagamento resta attivo fino al {0}.", "Ваш план не будет продлён. Платный доступ останется активным до {0}."),
  "Your {0} PayPal subscription is active. Next billing date: {1}.": row("Dein PayPal-Abonnement {0} ist aktiv. Nächstes Abrechnungsdatum: {1}.", "Tu suscripción PayPal {0} está activa. Próxima fecha de facturación: {1}.", "Abonimi yt PayPal {0} është aktiv. Data e ardhshme e faturimit: {1}.", "اشتراك PayPal {0} نشط. تاريخ الفوترة التالي: {1}.", "A sua subscrição PayPal {0} está ativa. Próxima data de faturação: {1}.", "Il tuo abbonamento PayPal {0} è attivo. Prossima data di fatturazione: {1}.", "Ваша подписка PayPal {0} активна. Следующая дата списания: {1}."),
  "Your {0} PayPal subscription is active.": row("Dein PayPal-Abonnement {0} ist aktiv.", "Tu suscripción PayPal {0} está activa.", "Abonimi yt PayPal {0} është aktiv.", "اشتراك PayPal {0} نشط.", "A sua subscrição PayPal {0} está ativa.", "Il tuo abbonamento PayPal {0} è attivo.", "Ваша подписка PayPal {0} активна."),
  "1 {0} = {1} EUR · rate date {2}": row("1 {0} = {1} EUR · Kursdatum {2}", "1 {0} = {1} EUR · fecha del tipo {2}", "1 {0} = {1} EUR · data e kursit {2}", "1 {0} = {1} EUR · تاريخ السعر {2}", "1 {0} = {1} EUR · data da taxa {2}", "1 {0} = {1} EUR · data del tasso {2}", "1 {0} = {1} EUR · дата курса {2}"),
  "{0} transactions deleted; {1}.": row("{0} Transaktionen gelöscht; {1}.", "{0} transacciones eliminadas; {1}.", "{0} transaksione u fshinë; {1}.", "تم حذف {0} معاملات؛ {1}.", "{0} transações eliminadas; {1}.", "{0} transazioni eliminate; {1}.", "Удалено {0} транзакций; {1}."),
  "{0} transactions deleted.": row("{0} Transaktionen gelöscht.", "{0} transacciones eliminadas.", "{0} transaksione u fshinë.", "تم حذف {0} معاملات.", "{0} transações eliminadas.", "{0} transazioni eliminate.", "Удалено {0} транзакций."),
  "Select {0}": row("{0} auswählen", "Seleccionar {0}", "Zgjidh {0}", "اختيار {0}", "Selecionar {0}", "Seleziona {0}", "Выбрать {0}"),
  "{0} · 1 {1} = {2} EUR": row("{0} · 1 {1} = {2} EUR", "{0} · 1 {1} = {2} EUR", "{0} · 1 {1} = {2} EUR", "{0} · 1 {1} = {2} EUR", "{0} · 1 {1} = {2} EUR", "{0} · 1 {1} = {2} EUR", "{0} · 1 {1} = {2} EUR"),
  "Base currency equivalent: {0} · displayed in {1}": row("Gegenwert in Basiswährung: {0} · angezeigt in {1}", "Equivalente en moneda base: {0} · mostrado en {1}", "Ekuivalenti në monedhën bazë: {0} · shfaqur në {1}", "المعادل بالعملة الأساسية: {0} · معروض بـ {1}", "Equivalente na moeda base: {0} · apresentado em {1}", "Equivalente nella valuta di base: {0} · visualizzato in {1}", "Эквивалент в базовой валюте: {0} · отображается в {1}"),
  "Base currency equivalent: {0} · no conversion required": row("Gegenwert in Basiswährung: {0} · keine Umrechnung erforderlich", "Equivalente en moneda base: {0} · no se requiere conversión", "Ekuivalenti në monedhën bazë: {0} · nuk kërkohet konvertim", "المعادل بالعملة الأساسية: {0} · لا يلزم تحويل", "Equivalente na moeda base: {0} · não é necessária conversão", "Equivalente nella valuta di base: {0} · nessuna conversione necessaria", "Эквивалент в базовой валюте: {0} · конвертация не требуется"),
  "Displayed in {0} · reference date {1}": row("Angezeigt in {0} · Referenzdatum {1}", "Mostrado en {0} · fecha de referencia {1}", "Shfaqur në {0} · data e referencës {1}", "معروض بـ {0} · تاريخ المرجع {1}", "Apresentado em {0} · data de referência {1}", "Visualizzato in {0} · data di riferimento {1}", "Отображается в {0} · справочная дата {1}"),
  "{0} navigation": row("Navigation für {0}", "Navegación de {0}", "Navigimi për {0}", "التنقل في {0}", "Navegação de {0}", "Navigazione di {0}", "Навигация: {0}")
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

const COMPILED = Object.entries(GLOBAL_RUNTIME_TEMPLATES).map(
  ([source, translations]) => ({ translations, regex: compileTemplate(source) }),
);

export function translateGlobalTemplate(
  language: FiconterLanguage,
  source: string,
  translateToken: (value: string) => string,
): string | null {
  if (language === "en") return source;
  for (const entry of COMPILED) {
    const match = source.match(entry.regex);
    if (!match) continue;
    return entry.translations[language].replace(/\{(\d+)\}/g, (_, rawIndex: string) => {
      const index = Number(rawIndex) + 1;
      return translateToken(match[index] ?? "");
    });
  }
  return null;
}
