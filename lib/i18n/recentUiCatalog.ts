import type { FiconterLanguage } from "./config";

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
 * Supplemental coverage for user-facing UI introduced after the main
 * localization catalog was generated. Keeping these strings in one catalog
 * lets the existing MutationObserver-based language bridge translate recent
 * screens without changing their navigation or business logic.
 */
const RECENT_UI_TRANSLATIONS: Record<string, TranslationRow> = {
  // Recent authentication / login presentation.
  "FICONTER account": row("FICONTER-Konto", "Cuenta FICONTER", "Llogaria FICONTER", "حساب FICONTER", "Conta FICONTER", "Account FICONTER", "Аккаунт FICONTER"),
  "Welcome back.": row("Willkommen zurück.", "Te damos la bienvenida de nuevo.", "Mirë se u riktheve.", "مرحبًا بعودتك.", "Bem-vindo de volta.", "Bentornato.", "С возвращением."),
  "Sign in to continue to your Financial Control Center.": row("Melde dich an, um zu deinem Financial Control Center fortzufahren.", "Inicia sesión para continuar a tu Financial Control Center.", "Hyr për të vazhduar te Financial Control Center-i yt.", "سجّل الدخول للمتابعة إلى مركز التحكم المالي الخاص بك.", "Inicie sessão para continuar para o seu Financial Control Center.", "Accedi per continuare nel tuo Financial Control Center.", "Войдите, чтобы перейти в ваш Financial Control Center."),
  "Secure access": row("Sicherer Zugang", "Acceso seguro", "Qasje e sigurt", "وصول آمن", "Acesso seguro", "Accesso sicuro", "Безопасный доступ"),
  "Return to your financial world.": row("Kehre in deine Finanzwelt zurück.", "Vuelve a tu mundo financiero.", "Kthehu në botën tënde financiare.", "عُد إلى عالمك المالي.", "Regresse ao seu mundo financeiro.", "Torna al tuo mondo finanziario.", "Вернитесь в свой финансовый мир."),
  "Continue exactly where you left off, with your personal and business finances kept clear, private and connected.": row("Mach genau dort weiter, wo du aufgehört hast – mit klaren, privaten und verbundenen persönlichen und geschäftlichen Finanzen.", "Continúa exactamente donde lo dejaste, con tus finanzas personales y empresariales claras, privadas y conectadas.", "Vazhdo pikërisht aty ku e le, me financat personale dhe të biznesit të qarta, private dhe të lidhura.", "تابع من حيث توقفت تمامًا، مع بقاء أموالك الشخصية والتجارية واضحة وخاصة ومترابطة.", "Continue exatamente onde parou, com as suas finanças pessoais e empresariais claras, privadas e ligadas.", "Continua esattamente da dove avevi lasciato, con finanze personali e aziendali chiare, private e collegate.", "Продолжайте с того места, где остановились: личные и деловые финансы остаются понятными, приватными и связанными."),
  "Private workspace": row("Privater Arbeitsbereich", "Espacio privado", "Hapësirë private pune", "مساحة عمل خاصة", "Espaço de trabalho privado", "Area di lavoro privata", "Приватное рабочее пространство"),
  "Secure authentication": row("Sichere Authentifizierung", "Autenticación segura", "Autentikim i sigurt", "مصادقة آمنة", "Autenticação segura", "Autenticazione sicura", "Безопасная аутентификация"),
  "Personal & business": row("Privat & Geschäftlich", "Personal y empresa", "Personale & biznes", "شخصي وتجاري", "Pessoal e empresarial", "Personale e aziendale", "Личное и бизнес"),
  "Your financial workspace remains private by design.": row("Dein Finanzarbeitsbereich bleibt von Grund auf privat.", "Tu espacio financiero es privado por diseño.", "Hapësira jote financiare mbetet private që në projektim.", "تظل مساحة عملك المالية خاصة بحكم التصميم.", "O seu espaço financeiro permanece privado por conceção.", "Il tuo spazio finanziario resta privato per progettazione.", "Ваше финансовое пространство приватно по замыслу."),
  "Back to homepage": row("Zurück zur Startseite", "Volver a la página de inicio", "Kthehu te faqja kryesore", "العودة إلى الصفحة الرئيسية", "Voltar à página inicial", "Torna alla home", "Вернуться на главную"),
  "or": row("oder", "o", "ose", "أو", "ou", "oppure", "или"),
  "Verifying passkey…": row("Passkey wird geprüft…", "Verificando la clave de acceso…", "Po verifikohet passkey…", "جارٍ التحقق من مفتاح المرور…", "A verificar a chave de acesso…", "Verifica della passkey…", "Проверка ключа доступа…"),
  "Continue with Face ID / passkey": row("Mit Face ID / Passkey fortfahren", "Continuar con Face ID / clave de acceso", "Vazhdo me Face ID / passkey", "المتابعة باستخدام Face ID / مفتاح المرور", "Continuar com Face ID / chave de acesso", "Continua con Face ID / passkey", "Продолжить с Face ID / ключом доступа"),
  "Passkey sign-in could not be completed.": row("Die Anmeldung mit Passkey konnte nicht abgeschlossen werden.", "No se pudo completar el inicio de sesión con clave de acceso.", "Hyrja me passkey nuk mund të përfundohej.", "تعذر إكمال تسجيل الدخول باستخدام مفتاح المرور.", "Não foi possível concluir o início de sessão com chave de acesso.", "Non è stato possibile completare l'accesso con passkey.", "Не удалось завершить вход с ключом доступа."),

  // Face ID / passkey settings introduced in the installed app.
  "App security": row("App-Sicherheit", "Seguridad de la app", "Siguria e aplikacionit", "أمان التطبيق", "Segurança da app", "Sicurezza dell'app", "Безопасность приложения"),
  "Face ID & passkeys": row("Face ID & Passkeys", "Face ID y claves de acceso", "Face ID & passkeys", "Face ID ومفاتيح المرور", "Face ID e chaves de acesso", "Face ID e passkey", "Face ID и ключи доступа"),
  "Add a passkey for the installed FICONTER app. On supported devices you can use Face ID, Touch ID, or the device authenticator without exposing biometric data to FICONTER.": row("Füge einen Passkey für die installierte FICONTER-App hinzu. Auf unterstützten Geräten kannst du Face ID, Touch ID oder die Geräteauthentifizierung verwenden, ohne biometrische Daten an FICONTER weiterzugeben.", "Añade una clave de acceso para la app FICONTER instalada. En dispositivos compatibles puedes usar Face ID, Touch ID o el autenticador del dispositivo sin exponer datos biométricos a FICONTER.", "Shto një passkey për aplikacionin e instaluar FICONTER. Në pajisjet e mbështetura mund të përdorësh Face ID, Touch ID ose autentikuesin e pajisjes pa i ekspozuar FICONTER-it të dhënat biometrike.", "أضف مفتاح مرور لتطبيق FICONTER المثبّت. على الأجهزة المدعومة يمكنك استخدام Face ID أو Touch ID أو مصادقة الجهاز من دون كشف بياناتك البيومترية لـ FICONTER.", "Adicione uma chave de acesso para a app FICONTER instalada. Em dispositivos compatíveis pode usar Face ID, Touch ID ou o autenticador do dispositivo sem expor dados biométricos à FICONTER.", "Aggiungi una passkey per l'app FICONTER installata. Sui dispositivi supportati puoi usare Face ID, Touch ID o l'autenticatore del dispositivo senza esporre dati biometrici a FICONTER.", "Добавьте ключ доступа для установленного приложения FICONTER. На поддерживаемых устройствах можно использовать Face ID, Touch ID или аутентификатор устройства, не передавая биометрические данные FICONTER."),
  "This device does not currently expose secure passkey authentication. Your password login remains available.": row("Dieses Gerät stellt derzeit keine sichere Passkey-Authentifizierung bereit. Die Anmeldung mit Passwort bleibt verfügbar.", "Este dispositivo no ofrece actualmente autenticación segura con clave de acceso. El inicio de sesión con contraseña sigue disponible.", "Kjo pajisje aktualisht nuk ofron autentikim të sigurt me passkey. Hyrja me fjalëkalim mbetet e disponueshme.", "هذا الجهاز لا يوفّر حاليًا مصادقة آمنة بمفتاح المرور. يظل تسجيل الدخول بكلمة المرور متاحًا.", "Este dispositivo não disponibiliza atualmente autenticação segura por chave de acesso. O início de sessão por palavra-passe continua disponível.", "Questo dispositivo al momento non espone un'autenticazione sicura tramite passkey. L'accesso con password resta disponibile.", "Это устройство сейчас не предоставляет безопасную аутентификацию по ключу доступа. Вход по паролю остаётся доступен."),
  "Passkeys are phishing-resistant and stay protected by your device or password manager.": row("Passkeys sind phishingresistent und bleiben durch dein Gerät oder deinen Passwortmanager geschützt.", "Las claves de acceso son resistentes al phishing y permanecen protegidas por tu dispositivo o gestor de contraseñas.", "Passkeys janë rezistente ndaj phishing-ut dhe mbrohen nga pajisja ose menaxheri yt i fjalëkalimeve.", "مفاتيح المرور مقاومة للتصيد وتبقى محمية بواسطة جهازك أو مدير كلمات المرور.", "As chaves de acesso são resistentes a phishing e ficam protegidas pelo seu dispositivo ou gestor de palavras-passe.", "Le passkey resistono al phishing e restano protette dal dispositivo o dal gestore password.", "Ключи доступа устойчивы к фишингу и защищаются вашим устройством или менеджером паролей."),
  "Adding passkey…": row("Passkey wird hinzugefügt…", "Añadiendo clave de acceso…", "Po shtohet passkey…", "جارٍ إضافة مفتاح المرور…", "A adicionar chave de acesso…", "Aggiunta passkey…", "Добавление ключа доступа…"),
  "Add passkey": row("Passkey hinzufügen", "Añadir clave de acceso", "Shto passkey", "إضافة مفتاح مرور", "Adicionar chave de acesso", "Aggiungi passkey", "Добавить ключ доступа"),
  "Loading passkeys…": row("Passkeys werden geladen…", "Cargando claves de acceso…", "Po ngarkohen passkeys…", "جارٍ تحميل مفاتيح المرور…", "A carregar chaves de acesso…", "Caricamento passkey…", "Загрузка ключей доступа…"),
  "No app passkeys are registered yet. Your password continues to work normally.": row("Es sind noch keine App-Passkeys registriert. Dein Passwort funktioniert weiterhin normal.", "Aún no hay claves de acceso registradas para la app. Tu contraseña sigue funcionando con normalidad.", "Ende nuk ka passkeys të regjistruara për aplikacionin. Fjalëkalimi yt vazhdon të funksionojë normalisht.", "لم يتم تسجيل أي مفاتيح مرور للتطبيق بعد. تظل كلمة المرور تعمل بشكل طبيعي.", "Ainda não existem chaves de acesso registadas para a app. A sua palavra-passe continua a funcionar normalmente.", "Non sono ancora registrate passkey per l'app. La password continua a funzionare normalmente.", "Ключи доступа приложения пока не зарегистрированы. Пароль продолжает работать как обычно."),
  "FICONTER app passkey": row("FICONTER-App-Passkey", "Clave de acceso de la app FICONTER", "Passkey i aplikacionit FICONTER", "مفتاح مرور تطبيق FICONTER", "Chave de acesso da app FICONTER", "Passkey dell'app FICONTER", "Ключ доступа приложения FICONTER"),
  "My passkey": row("Mein Passkey", "Mi clave de acceso", "Passkey im", "مفتاح المرور الخاص بي", "A minha chave de acesso", "La mia passkey", "Мой ключ доступа"),
  "Passkey name": row("Passkey-Name", "Nombre de la clave de acceso", "Emri i passkey", "اسم مفتاح المرور", "Nome da chave de acesso", "Nome passkey", "Имя ключа доступа"),
  "Registered passkey": row("Registrierter Passkey", "Clave de acceso registrada", "Passkey i regjistruar", "مفتاح مرور مسجل", "Chave de acesso registada", "Passkey registrata", "Зарегистрированный ключ доступа"),
  "Rename": row("Umbenennen", "Cambiar nombre", "Riemërto", "إعادة تسمية", "Mudar nome", "Rinomina", "Переименовать"),
  "Removing…": row("Wird entfernt…", "Eliminando…", "Po hiqet…", "جارٍ الإزالة…", "A remover…", "Rimozione…", "Удаление…"),
  "Remove": row("Entfernen", "Eliminar", "Hiq", "إزالة", "Remover", "Rimuovi", "Удалить"),
  "Save": row("Speichern", "Guardar", "Ruaj", "حفظ", "Guardar", "Salva", "Сохранить"),
  "Cancel": row("Abbrechen", "Cancelar", "Anulo", "إلغاء", "Cancelar", "Annulla", "Отмена"),
  "Passkeys could not be loaded.": row("Passkeys konnten nicht geladen werden.", "No se pudieron cargar las claves de acceso.", "Passkeys nuk mund të ngarkoheshin.", "تعذر تحميل مفاتيح المرور.", "Não foi possível carregar as chaves de acesso.", "Non è stato possibile caricare le passkey.", "Не удалось загрузить ключи доступа."),
  "Passkey added. On supported Apple devices, Face ID or Touch ID can now be used to sign in.": row("Passkey hinzugefügt. Auf unterstützten Apple-Geräten kann jetzt Face ID oder Touch ID zur Anmeldung verwendet werden.", "Clave de acceso añadida. En dispositivos Apple compatibles ya puedes usar Face ID o Touch ID para iniciar sesión.", "Passkey u shtua. Në pajisjet Apple të mbështetura tani mund të përdoret Face ID ose Touch ID për hyrje.", "تمت إضافة مفتاح المرور. على أجهزة Apple المدعومة يمكن الآن استخدام Face ID أو Touch ID لتسجيل الدخول.", "Chave de acesso adicionada. Em dispositivos Apple compatíveis, Face ID ou Touch ID já podem ser usados para iniciar sessão.", "Passkey aggiunta. Sui dispositivi Apple supportati ora puoi usare Face ID o Touch ID per accedere.", "Ключ доступа добавлен. На поддерживаемых устройствах Apple теперь можно использовать Face ID или Touch ID для входа."),
  "The passkey could not be added.": row("Der Passkey konnte nicht hinzugefügt werden.", "No se pudo añadir la clave de acceso.", "Passkey nuk mund të shtohej.", "تعذر إضافة مفتاح المرور.", "Não foi possível adicionar a chave de acesso.", "Non è stato possibile aggiungere la passkey.", "Не удалось добавить ключ доступа."),
  "Passkey removed from your FICONTER account.": row("Passkey wurde aus deinem FICONTER-Konto entfernt.", "La clave de acceso se eliminó de tu cuenta FICONTER.", "Passkey u hoq nga llogaria jote FICONTER.", "تمت إزالة مفتاح المرور من حساب FICONTER الخاص بك.", "A chave de acesso foi removida da sua conta FICONTER.", "La passkey è stata rimossa dal tuo account FICONTER.", "Ключ доступа удалён из вашего аккаунта FICONTER."),
  "The passkey could not be removed.": row("Der Passkey konnte nicht entfernt werden.", "No se pudo eliminar la clave de acceso.", "Passkey nuk mund të hiqej.", "تعذر إزالة مفتاح المرور.", "Não foi possível remover a chave de acesso.", "Non è stato possibile rimuovere la passkey.", "Не удалось удалить ключ доступа."),
  "Passkey name updated.": row("Passkey-Name aktualisiert.", "Nombre de la clave de acceso actualizado.", "Emri i passkey u përditësua.", "تم تحديث اسم مفتاح المرور.", "Nome da chave de acesso atualizado.", "Nome della passkey aggiornato.", "Имя ключа доступа обновлено."),
  "The passkey name could not be updated.": row("Der Passkey-Name konnte nicht aktualisiert werden.", "No se pudo actualizar el nombre de la clave de acceso.", "Emri i passkey nuk mund të përditësohej.", "تعذر تحديث اسم مفتاح المرور.", "Não foi possível atualizar o nome da chave de acesso.", "Non è stato possibile aggiornare il nome della passkey.", "Не удалось обновить имя ключа доступа."),

  // Installed-app Transaction Ledger controls added in the recent mobile pass.
  "App transaction controls": row("App-Transaktionssteuerung", "Controles de transacciones de la app", "Kontrollet e transaksioneve të aplikacionit", "عناصر تحكم معاملات التطبيق", "Controlos de transações da app", "Controlli transazioni dell'app", "Элементы управления транзакциями приложения"),
  "Search transactions": row("Transaktionen suchen", "Buscar transacciones", "Kërko transaksione", "البحث في المعاملات", "Pesquisar transações", "Cerca transazioni", "Поиск транзакций"),
  "Refine transactions": row("Transaktionen verfeinern", "Refinar transacciones", "Filtro transaksionet", "تصفية المعاملات", "Refinar transações", "Affina transazioni", "Уточнить транзакции"),
  "Transaction actions": row("Transaktionsaktionen", "Acciones de transacciones", "Veprimet e transaksioneve", "إجراءات المعاملات", "Ações de transações", "Azioni transazioni", "Действия с транзакциями"),
  "Quick transaction filters": row("Schnellfilter für Transaktionen", "Filtros rápidos de transacciones", "Filtra të shpejtë të transaksioneve", "مرشحات سريعة للمعاملات", "Filtros rápidos de transações", "Filtri rapidi transazioni", "Быстрые фильтры транзакций"),
  "All": row("Alle", "Todo", "Të gjitha", "الكل", "Tudo", "Tutto", "Все"),
  "Income": row("Einnahmen", "Ingresos", "Të ardhura", "الدخل", "Rendimentos", "Entrate", "Доходы"),
  "Expenses": row("Ausgaben", "Gastos", "Shpenzime", "المصروفات", "Despesas", "Spese", "Расходы"),
  "Refine transaction list": row("Transaktionsliste verfeinern", "Refinar lista de transacciones", "Filtro listën e transaksioneve", "تصفية قائمة المعاملات", "Refinar lista de transações", "Affina elenco transazioni", "Уточнить список транзакций"),
  "Only show what you need": row("Nur das anzeigen, was du brauchst", "Muestra solo lo que necesitas", "Shfaq vetëm atë që të duhet", "اعرض فقط ما تحتاجه", "Mostrar apenas o que precisa", "Mostra solo ciò che ti serve", "Показывать только нужное"),
  "Movement": row("Bewegung", "Movimiento", "Lëvizja", "الحركة", "Movimento", "Movimento", "Движение"),
  "All movements": row("Alle Bewegungen", "Todos los movimientos", "Të gjitha lëvizjet", "كل الحركات", "Todos os movimentos", "Tutti i movimenti", "Все движения"),
  "Cash inflows": row("Geldzuflüsse", "Entradas de efectivo", "Hyrje parash", "التدفقات النقدية الداخلة", "Entradas de caixa", "Entrate di cassa", "Денежные поступления"),
  "Cash outflows": row("Geldabflüsse", "Salidas de efectivo", "Dalje parash", "التدفقات النقدية الخارجة", "Saídas de caixa", "Uscite di cassa", "Денежные расходы"),
  "Transfers / adjustments": row("Übertragungen / Anpassungen", "Transferencias / ajustes", "Transferta / rregullime", "تحويلات / تعديلات", "Transferências / ajustes", "Trasferimenti / rettifiche", "Переводы / корректировки"),
  "Category": row("Kategorie", "Categoría", "Kategoria", "الفئة", "Categoria", "Categoria", "Категория"),
  "All categories": row("Alle Kategorien", "Todas las categorías", "Të gjitha kategoritë", "كل الفئات", "Todas as categorias", "Tutte le categorie", "Все категории"),
  "Currency": row("Währung", "Moneda", "Monedha", "العملة", "Moeda", "Valuta", "Валюта"),
  "All currencies": row("Alle Währungen", "Todas las monedas", "Të gjitha monedhat", "كل العملات", "Todas as moedas", "Tutte le valute", "Все валюты"),
  "Month": row("Monat", "Mes", "Muaji", "الشهر", "Mês", "Mese", "Месяц"),
  "All months": row("Alle Monate", "Todos los meses", "Të gjithë muajt", "كل الأشهر", "Todos os meses", "Tutti i mesi", "Все месяцы"),
  "Sort": row("Sortieren", "Ordenar", "Rendit", "الترتيب", "Ordenar", "Ordina", "Сортировка"),
  "Newest first": row("Neueste zuerst", "Más recientes primero", "Më të rejat të parat", "الأحدث أولًا", "Mais recentes primeiro", "Più recenti prima", "Сначала новые"),
  "Oldest first": row("Älteste zuerst", "Más antiguas primero", "Më të vjetrat të parat", "الأقدم أولًا", "Mais antigas primeiro", "Più vecchie prima", "Сначала старые"),
  "Highest amount": row("Höchster Betrag", "Importe más alto", "Shuma më e lartë", "أعلى مبلغ", "Montante mais alto", "Importo più alto", "Наибольшая сумма"),
  "Lowest amount": row("Niedrigster Betrag", "Importe más bajo", "Shuma më e ulët", "أقل مبلغ", "Montante mais baixo", "Importo più basso", "Наименьшая сумма"),
  "Description A–Z": row("Beschreibung A–Z", "Descripción A–Z", "Përshkrimi A–Z", "الوصف أ–ي", "Descrição A–Z", "Descrizione A–Z", "Описание А–Я"),
  "Reset view": row("Ansicht zurücksetzen", "Restablecer vista", "Rivendos pamjen", "إعادة ضبط العرض", "Repor vista", "Reimposta vista", "Сбросить вид"),
  "More actions": row("Weitere Aktionen", "Más acciones", "Më shumë veprime", "إجراءات إضافية", "Mais ações", "Altre azioni", "Другие действия"),
  "Tools stay available without crowding the ledger": row("Werkzeuge bleiben verfügbar, ohne das Journal zu überladen", "Las herramientas siguen disponibles sin saturar el registro", "Mjetet mbeten të disponueshme pa mbingarkuar regjistrin", "تبقى الأدوات متاحة دون ازدحام سجل المعاملات", "As ferramentas continuam disponíveis sem sobrecarregar o registo", "Gli strumenti restano disponibili senza affollare il registro", "Инструменты остаются доступными, не перегружая журнал"),
  "Export current view": row("Aktuelle Ansicht exportieren", "Exportar vista actual", "Eksporto pamjen aktuale", "تصدير العرض الحالي", "Exportar vista atual", "Esporta vista corrente", "Экспортировать текущий вид"),
  "Preparing…": row("Wird vorbereitet…", "Preparando…", "Po përgatitet…", "جارٍ التحضير…", "A preparar…", "Preparazione…", "Подготовка…"),
  "Private export": row("Privater Export", "Exportación privada", "Eksport privat", "تصدير خاص", "Exportação privada", "Esportazione privata", "Приватный экспорт"),
  "Done selecting": row("Auswahl beenden", "Terminar selección", "Përfundo zgjedhjen", "إنهاء التحديد", "Concluir seleção", "Fine selezione", "Завершить выбор"),
  "Select transactions": row("Transaktionen auswählen", "Seleccionar transacciones", "Zgjidh transaksionet", "تحديد المعاملات", "Selecionar transações", "Seleziona transazioni", "Выбрать транзакции"),
  "Bulk export or delete": row("Mehrere exportieren oder löschen", "Exportar o eliminar en lote", "Eksporto ose fshi në grup", "تصدير أو حذف جماعي", "Exportar ou eliminar em lote", "Esporta o elimina in blocco", "Массовый экспорт или удаление"),
  "Transaction cash flow summary": row("Cashflow-Zusammenfassung der Transaktionen", "Resumen de flujo de caja de transacciones", "Përmbledhja e rrjedhës së parasë së transaksioneve", "ملخص التدفق النقدي للمعاملات", "Resumo do fluxo de caixa das transações", "Riepilogo flusso di cassa delle transazioni", "Сводка денежного потока по транзакциям"),
  "Net cash flow": row("Netto-Cashflow", "Flujo de caja neto", "Rrjedha neto e parasë", "صافي التدفق النقدي", "Fluxo de caixa líquido", "Flusso di cassa netto", "Чистый денежный поток"),
  "In": row("Ein", "Entrada", "Hyrje", "داخل", "Entrada", "Entrate", "Входящие"),
  "Out": row("Aus", "Salida", "Dalje", "خارج", "Saída", "Uscite", "Исходящие"),

  // In-app Help Center introduced during the recent Help / FAQ pass.
  "PRIVATE SUPPORT CENTER": row("PRIVATES SUPPORT-CENTER", "CENTRO DE SOPORTE PRIVADO", "QENDËR PRIVATE MBËSHTETJEJE", "مركز الدعم الخاص", "CENTRO DE SUPORTE PRIVADO", "CENTRO ASSISTENZA PRIVATO", "ПРИВАТНЫЙ ЦЕНТР ПОДДЕРЖКИ"),
  "Help Center": row("Hilfe-Center", "Centro de ayuda", "Qendra e ndihmës", "مركز المساعدة", "Centro de ajuda", "Centro assistenza", "Центр помощи"),
  "Practical guidance for using FICONTER’s financial workspace, Wealth Engine and privacy controls.": row("Praktische Hilfe zur Nutzung des FICONTER-Finanzarbeitsbereichs, der Wealth Engine und der Datenschutzkontrollen.", "Guía práctica para usar el espacio financiero de FICONTER, Wealth Engine y los controles de privacidad.", "Udhëzime praktike për përdorimin e hapësirës financiare të FICONTER, Wealth Engine dhe kontrolleve të privatësisë.", "إرشادات عملية لاستخدام مساحة FICONTER المالية ومحرك الثروة وعناصر التحكم في الخصوصية.", "Orientação prática para utilizar o espaço financeiro da FICONTER, o Wealth Engine e os controlos de privacidade.", "Guida pratica all'uso dell'area finanziaria FICONTER, del Wealth Engine e dei controlli sulla privacy.", "Практическое руководство по финансовому пространству FICONTER, Wealth Engine и настройкам конфиденциальности."),
  "In-app guidance": row("Hilfe in der App", "Guía en la app", "Udhëzim në aplikacion", "إرشادات داخل التطبيق", "Orientação na app", "Guida nell'app", "Подсказки в приложении"),
  "Privacy first": row("Datenschutz zuerst", "Privacidad primero", "Privatësia në radhë të parë", "الخصوصية أولًا", "Privacidade em primeiro lugar", "Privacy prima di tutto", "Конфиденциальность прежде всего"),
  "Your financial values remain private.": row("Deine Finanzwerte bleiben privat.", "Tus valores financieros siguen siendo privados.", "Vlerat e tua financiare mbeten private.", "تظل قيمك المالية خاصة.", "Os seus valores financeiros permanecem privados.", "I tuoi valori finanziari restano privati.", "Ваши финансовые показатели остаются приватными."),
  "One source of truth": row("Eine Datenquelle", "Una única fuente de verdad", "Një burim i vetëm i së vërtetës", "مصدر واحد للحقيقة", "Uma única fonte de verdade", "Un'unica fonte di verità", "Единый источник данных"),
  "Connected modules stay synchronized.": row("Verbundene Module bleiben synchronisiert.", "Los módulos conectados permanecen sincronizados.", "Modulet e lidhura mbeten të sinkronizuara.", "تبقى الوحدات المتصلة متزامنة.", "Os módulos ligados permanecem sincronizados.", "I moduli collegati restano sincronizzati.", "Связанные модули остаются синхронизированными."),
  "Private development": row("Private Entwicklung", "Desarrollo privado", "Zhvillim privat", "تطوير خاص", "Desenvolvimento privado", "Sviluppo privato", "Приватная разработка"),
  "Commercial payments remain disabled.": row("Kommerzielle Zahlungen bleiben deaktiviert.", "Los pagos comerciales siguen desactivados.", "Pagesat komerciale mbeten të çaktivizuara.", "تظل المدفوعات التجارية معطلة.", "Os pagamentos comerciais permanecem desativados.", "I pagamenti commerciali restano disattivati.", "Коммерческие платежи остаются отключены."),
  "PRODUCT GUIDES": row("PRODUKTANLEITUNGEN", "GUÍAS DEL PRODUCTO", "UDHËZUES TË PRODUKTIT", "أدلة المنتج", "GUIAS DO PRODUTO", "GUIDE DEL PRODOTTO", "РУКОВОДСТВА ПО ПРОДУКТУ"),
  "Find the right workspace": row("Den richtigen Arbeitsbereich finden", "Encuentra el espacio adecuado", "Gjej hapësirën e duhur të punës", "اعثر على مساحة العمل المناسبة", "Encontre o espaço de trabalho certo", "Trova l'area di lavoro giusta", "Найдите нужное рабочее пространство"),
  "Each guide explains what the module controls and how it connects to the rest of FICONTER.": row("Jede Anleitung erklärt, was das Modul steuert und wie es mit dem restlichen FICONTER verbunden ist.", "Cada guía explica qué controla el módulo y cómo se conecta con el resto de FICONTER.", "Çdo udhëzues shpjegon çfarë kontrollon moduli dhe si lidhet me pjesën tjetër të FICONTER.", "يشرح كل دليل ما تتحكم به الوحدة وكيف ترتبط ببقية FICONTER.", "Cada guia explica o que o módulo controla e como se liga ao resto da FICONTER.", "Ogni guida spiega cosa controlla il modulo e come si collega al resto di FICONTER.", "Каждое руководство объясняет назначение модуля и его связь с остальной системой FICONTER."),
  "Transactions": row("Transaktionen", "Transacciones", "Transaksionet", "المعاملات", "Transações", "Transazioni", "Транзакции"),
  "Record income and expenses, edit details, remove entries and understand base-currency conversion.": row("Erfasse Einnahmen und Ausgaben, bearbeite Details, entferne Einträge und verstehe die Umrechnung in die Basiswährung.", "Registra ingresos y gastos, edita detalles, elimina entradas y comprende la conversión a la moneda base.", "Regjistro të ardhura dhe shpenzime, ndrysho detajet, hiq hyrjet dhe kupto konvertimin në monedhën bazë.", "سجّل الدخل والمصروفات وعدّل التفاصيل واحذف الإدخالات وافهم التحويل إلى العملة الأساسية.", "Registe rendimentos e despesas, edite detalhes, remova entradas e compreenda a conversão para a moeda base.", "Registra entrate e spese, modifica i dettagli, rimuovi voci e comprendi la conversione nella valuta base.", "Записывайте доходы и расходы, редактируйте детали, удаляйте записи и отслеживайте пересчёт в базовую валюту."),
  "Use General Income or General Expenses for every entry.": row("Verwende für jeden Eintrag Allgemeine Einnahmen oder Allgemeine Ausgaben.", "Usa Ingresos generales o Gastos generales para cada entrada.", "Përdor Të ardhura të përgjithshme ose Shpenzime të përgjithshme për çdo hyrje.", "استخدم الدخل العام أو المصروفات العامة لكل إدخال.", "Use Rendimentos gerais ou Despesas gerais para cada entrada.", "Usa Entrate generali o Spese generali per ogni voce.", "Для каждой записи используйте «Общие доходы» или «Общие расходы»."),
  "The original currency and local transaction time remain attached to the record.": row("Die ursprüngliche Währung und die lokale Transaktionszeit bleiben mit dem Datensatz verknüpft.", "La moneda original y la hora local de la transacción permanecen vinculadas al registro.", "Monedha origjinale dhe ora lokale e transaksionit mbeten të lidhura me regjistrimin.", "تبقى العملة الأصلية ووقت المعاملة المحلي مرتبطين بالسجل.", "A moeda original e a hora local da transação permanecem associadas ao registo.", "La valuta originale e l'ora locale della transazione restano associate al record.", "Исходная валюта и местное время транзакции сохраняются в записи."),
  "Linked modules update automatically after a saved change.": row("Verknüpfte Module werden nach einer gespeicherten Änderung automatisch aktualisiert.", "Los módulos vinculados se actualizan automáticamente tras guardar un cambio.", "Modulet e lidhura përditësohen automatikisht pas një ndryshimi të ruajtur.", "تتحدّث الوحدات المرتبطة تلقائيًا بعد حفظ التغيير.", "Os módulos ligados são atualizados automaticamente após uma alteração guardada.", "I moduli collegati si aggiornano automaticamente dopo una modifica salvata.", "Связанные модули обновляются автоматически после сохранённого изменения."),
  "Bills and commitments": row("Rechnungen und Verpflichtungen", "Facturas y compromisos", "Faturat dhe angazhimet", "الفواتير والالتزامات", "Contas e compromissos", "Fatture e impegni", "Счета и обязательства"),
  "Planner and savings": row("Planer und Sparen", "Planificador y ahorros", "Planifikuesi dhe kursimet", "المخطط والمدخرات", "Planeador e poupanças", "Pianificatore e risparmi", "Планировщик и сбережения"),
  "Goals and debt": row("Ziele und Schulden", "Objetivos y deuda", "Objektivat dhe borxhi", "الأهداف والديون", "Objetivos e dívida", "Obiettivi e debiti", "Цели и долги"),
  "Net worth and independence": row("Nettovermögen und Unabhängigkeit", "Patrimonio neto e independencia", "Pasuria neto dhe pavarësia", "صافي الثروة والاستقلال المالي", "Património líquido e independência", "Patrimonio netto e indipendenza", "Чистый капитал и независимость"),
  "Scores and Smart Insights": row("Bewertungen und Smart Insights", "Puntuaciones y Smart Insights", "Rezultatet dhe Smart Insights", "النتائج والرؤى الذكية", "Pontuações e Smart Insights", "Punteggi e Smart Insights", "Оценки и Smart Insights"),
  "Support inbox": row("Support-Postfach", "Bandeja de soporte", "Kutia e mbështetjes", "صندوق وارد الدعم", "Caixa de entrada do suporte", "Posta assistenza", "Входящие поддержки"),
  "Document Vault": row("Dokumenten-Tresor", "Bóveda de documentos", "Kasaforta e dokumenteve", "خزنة المستندات", "Cofre de documentos", "Cassaforte documenti", "Хранилище документов"),
  "COMMON QUESTIONS": row("HÄUFIGE FRAGEN", "PREGUNTAS FRECUENTES", "PYETJE TË ZAKONSHME", "أسئلة شائعة", "PERGUNTAS COMUNS", "DOMANDE COMUNI", "ЧАСТЫЕ ВОПРОСЫ"),
  "Frequently asked": row("Häufig gefragt", "Preguntas frecuentes", "Pyetjet e shpeshta", "الأسئلة المتكررة", "Perguntas frequentes", "Domande frequenti", "Часто спрашивают"),
  "Clear answers to the questions most likely to appear while testing the platform.": row("Klare Antworten auf die Fragen, die beim Testen der Plattform am häufigsten auftreten.", "Respuestas claras a las preguntas más probables durante las pruebas de la plataforma.", "Përgjigje të qarta për pyetjet që shfaqen më shpesh gjatë testimit të platformës.", "إجابات واضحة عن الأسئلة الأكثر احتمالًا أثناء اختبار المنصة.", "Respostas claras às perguntas mais prováveis durante os testes da plataforma.", "Risposte chiare alle domande più probabili durante il test della piattaforma.", "Понятные ответы на вопросы, которые чаще всего возникают при тестировании платформы."),
  "FULL FAQ": row("VOLLSTÄNDIGE FAQ", "FAQ COMPLETAS", "FAQ E PLOTË", "الأسئلة الشائعة الكاملة", "FAQ COMPLETAS", "FAQ COMPLETE", "ПОЛНЫЙ FAQ"),
  "Explore every FICONTER question and answer.": row("Entdecke alle Fragen und Antworten zu FICONTER.", "Explora todas las preguntas y respuestas de FICONTER.", "Shfleto çdo pyetje dhe përgjigje për FICONTER.", "استكشف جميع أسئلة وأجوبة FICONTER.", "Explore todas as perguntas e respostas da FICONTER.", "Esplora tutte le domande e risposte su FICONTER.", "Изучите все вопросы и ответы о FICONTER."),
  "Open FAQ": row("FAQ öffnen", "Abrir FAQ", "Hap FAQ", "فتح الأسئلة الشائعة", "Abrir FAQ", "Apri FAQ", "Открыть FAQ"),
  "STILL NEED HELP?": row("NOCH HILFE BENÖTIGT?", "¿AÚN NECESITAS AYUDA?", "ENDE TË DUHET NDIHMË?", "هل ما زلت بحاجة إلى مساعدة؟", "AINDA PRECISA DE AJUDA?", "SERVE ANCORA AIUTO?", "ВСЁ ЕЩЁ НУЖНА ПОМОЩЬ?"),
  "Tell us what is happening.": row("Sag uns, was passiert.", "Cuéntanos qué está pasando.", "Na trego çfarë po ndodh.", "أخبرنا بما يحدث.", "Diga-nos o que está a acontecer.", "Dicci cosa sta succedendo.", "Расскажите, что происходит."),
  "Contact Us": row("Kontakt", "Contáctanos", "Na kontakto", "اتصل بنا", "Contacte-nos", "Contattaci", "Связаться с нами"),

  // Common recent header / utility labels.
  "Search anything": row("Alles durchsuchen", "Buscar cualquier cosa", "Kërko gjithçka", "ابحث عن أي شيء", "Pesquisar tudo", "Cerca qualsiasi cosa", "Искать всё"),
  "Vault": row("Tresor", "Bóveda", "Kasaforta", "الخزنة", "Cofre", "Cassaforte", "Хранилище"),
  "Ask FICONTER": row("FICONTER fragen", "Preguntar a FICONTER", "Pyet FICONTER", "اسأل FICONTER", "Perguntar à FICONTER", "Chiedi a FICONTER", "Спросить FICONTER"),
  "Owner Music": row("Owner-Musik", "Música del propietario", "Muzika e pronarit", "موسيقى المالك", "Música do proprietário", "Musica proprietario", "Музыка владельца"),
};

function dynamicRecentTranslation(
  language: NonEnglishLanguage,
  source: string,
): string | null {
  let match = source.match(/^(\d+) active$/);
  if (match) {
    const n = match[1];
    return {
      de: `${n} aktiv`,
      es: `${n} activos`,
      sq: `${n} aktive`,
      ar: `${n} نشط`,
      pt: `${n} ativos`,
      it: `${n} attivi`,
      ru: `${n} активных`,
    }[language];
  }

  match = source.match(/^Added (.+)$/);
  if (match) {
    const value = match[1];
    return {
      de: `Hinzugefügt ${value}`,
      es: `Añadida ${value}`,
      sq: `Shtuar ${value}`,
      ar: `أُضيف ${value}`,
      pt: `Adicionada ${value}`,
      it: `Aggiunta ${value}`,
      ru: `Добавлен ${value}`,
    }[language];
  }

  match = source.match(/^· Last used (.+)$/);
  if (match) {
    const value = match[1];
    return {
      de: `· Zuletzt verwendet ${value}`,
      es: `· Último uso ${value}`,
      sq: `· Përdorur për herë të fundit ${value}`,
      ar: `· آخر استخدام ${value}`,
      pt: `· Última utilização ${value}`,
      it: `· Ultimo utilizzo ${value}`,
      ru: `· Последнее использование ${value}`,
    }[language];
  }

  return null;
}

export function translateRecentUiPhrase(
  language: FiconterLanguage,
  source: string,
): string | null {
  if (language === "en" || !source.trim()) return null;
  const row = RECENT_UI_TRANSLATIONS[source];
  if (row) return row[language];
  return dynamicRecentTranslation(language, source);
}

export const RECENT_UI_TRANSLATION_KEYS = Object.freeze(
  Object.keys(RECENT_UI_TRANSLATIONS),
);
