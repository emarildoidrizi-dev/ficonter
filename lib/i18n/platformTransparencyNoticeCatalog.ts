import type { FiconterLanguage } from "./config";
import { LANDING_UI_TRANSLATIONS } from "./landingUiCatalog";

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

Object.assign(LANDING_UI_TRANSLATIONS, {
  "Close platform notice": row(
    "Plattformhinweis schließen",
    "Cerrar aviso de la plataforma",
    "Mbyll njoftimin e platformës",
    "إغلاق إشعار المنصة",
    "Fechar aviso da plataforma",
    "Chiudi avviso della piattaforma",
    "Закрыть уведомление платформы",
  ),
  "Platform transparency notice": row(
    "Transparenzhinweis zur Plattform",
    "Aviso de transparencia de la plataforma",
    "Njoftim transparence për platformën",
    "إشعار الشفافية الخاص بالمنصة",
    "Aviso de transparência da plataforma",
    "Avviso di trasparenza della piattaforma",
    "Уведомление о прозрачности платформы",
  ),
  "FICONTER is ready for use.": row(
    "FICONTER ist einsatzbereit.",
    "FICONTER está listo para usarse.",
    "FICONTER është gati për përdorim.",
    "FICONTER جاهزة للاستخدام.",
    "A FICONTER está pronta a utilizar.",
    "FICONTER è pronta per l'uso.",
    "FICONTER готов к использованию.",
  ),
  "FICONTER is fully available for everyday use. As part of our commitment to providing a reliable, intuitive and continuously improving experience, we will continue refining selected areas of the platform.": row(
    "FICONTER steht vollständig für die tägliche Nutzung zur Verfügung. Im Rahmen unseres Anspruchs, ein zuverlässiges, intuitives und kontinuierlich verbessertes Nutzungserlebnis zu bieten, werden wir ausgewählte Bereiche der Plattform weiter verfeinern.",
    "FICONTER está plenamente disponible para el uso diario. Como parte de nuestro compromiso de ofrecer una experiencia fiable, intuitiva y en mejora continua, seguiremos perfeccionando determinadas áreas de la plataforma.",
    "FICONTER është plotësisht i disponueshëm për përdorim të përditshëm. Si pjesë e angazhimit tonë për të ofruar një përvojë të besueshme, intuitive dhe në përmirësim të vazhdueshëm, do të vazhdojmë të përsosim disa pjesë të platformës.",
    "FICONTER متاحة بالكامل للاستخدام اليومي. وفي إطار التزامنا بتقديم تجربة موثوقة وسهلة ومتطورة باستمرار، سنواصل تحسين بعض أجزاء المنصة بعناية.",
    "A FICONTER está totalmente disponível para utilização diária. Como parte do nosso compromisso de proporcionar uma experiência fiável, intuitiva e em melhoria contínua, continuaremos a aperfeiçoar áreas selecionadas da plataforma.",
    "FICONTER è pienamente disponibile per l'uso quotidiano. Nell'ambito del nostro impegno a offrire un'esperienza affidabile, intuitiva e in continuo miglioramento, continueremo a perfezionare alcune aree della piattaforma.",
    "FICONTER полностью доступен для повседневного использования. В рамках нашего стремления обеспечивать надёжный, понятный и постоянно улучшающийся опыт мы продолжим совершенствовать отдельные части платформы.",
  ),
  "Your financial data remains protected.": row(
    "Ihre Finanzdaten bleiben geschützt.",
    "Tus datos financieros permanecen protegidos.",
    "Të dhënat tuaja financiare mbeten të mbrojtura.",
    "تظل بياناتك المالية محمية.",
    "Os seus dados financeiros permanecem protegidos.",
    "I tuoi dati finanziari restano protetti.",
    "Ваши финансовые данные остаются защищёнными.",
  ),
  "Ongoing interface, performance and experience improvements are designed not to alter, remove or interfere with the financial data you add to your FICONTER account. Your information remains associated with your account while these improvements are introduced.": row(
    "Laufende Verbesserungen an Oberfläche, Leistung und Nutzungserlebnis sind so ausgelegt, dass die Finanzdaten, die Sie Ihrem FICONTER-Konto hinzufügen, weder verändert noch entfernt oder beeinträchtigt werden. Ihre Informationen bleiben Ihrem Konto zugeordnet, während diese Verbesserungen eingeführt werden.",
    "Las mejoras continuas de interfaz, rendimiento y experiencia están diseñadas para no modificar, eliminar ni interferir con los datos financieros que añades a tu cuenta FICONTER. Tu información seguirá asociada a tu cuenta mientras se introducen estas mejoras.",
    "Përmirësimet e vazhdueshme të ndërfaqes, performancës dhe përvojës janë projektuar që të mos ndryshojnë, fshijnë apo ndërhyjnë në të dhënat financiare që shtoni në llogarinë tuaj FICONTER. Informacioni juaj mbetet i lidhur me llogarinë tuaj gjatë zbatimit të këtyre përmirësimeve.",
    "تم تصميم التحسينات المستمرة على الواجهة والأداء وتجربة الاستخدام بحيث لا تعدّل أو تحذف أو تتداخل مع البيانات المالية التي تضيفها إلى حسابك في FICONTER. وتظل معلوماتك مرتبطة بحسابك أثناء إدخال هذه التحسينات.",
    "As melhorias contínuas da interface, desempenho e experiência são concebidas para não alterar, remover ou interferir com os dados financeiros que adiciona à sua conta FICONTER. As suas informações permanecem associadas à sua conta enquanto estas melhorias são introduzidas.",
    "I miglioramenti continui dell'interfaccia, delle prestazioni e dell'esperienza sono progettati per non modificare, rimuovere o interferire con i dati finanziari che aggiungi al tuo account FICONTER. Le tue informazioni restano associate al tuo account durante l'introduzione di questi miglioramenti.",
    "Текущие улучшения интерфейса, производительности и пользовательского опыта разработаны так, чтобы не изменять, не удалять и не затрагивать финансовые данные, которые вы добавляете в свой аккаунт FICONTER. Ваша информация остаётся связанной с вашим аккаунтом во время внедрения этих улучшений.",
  ),
  "Transparency is an important part of how we operate. As FICONTER continues to evolve, we will keep our users informed of meaningful changes that may affect their experience.": row(
    "Transparenz ist ein wichtiger Bestandteil unserer Arbeitsweise. Während sich FICONTER weiterentwickelt, werden wir unsere Nutzer über wesentliche Änderungen informieren, die ihre Nutzungserfahrung betreffen können.",
    "La transparencia es una parte importante de nuestra forma de operar. A medida que FICONTER evolucione, mantendremos informados a nuestros usuarios sobre los cambios relevantes que puedan afectar a su experiencia.",
    "Transparenca është një pjesë e rëndësishme e mënyrës sonë të punës. Ndërsa FICONTER vazhdon të zhvillohet, do t'i mbajmë përdoruesit tanë të informuar për ndryshime të rëndësishme që mund të ndikojnë në përvojën e tyre.",
    "الشفافية جزء مهم من طريقة عملنا. ومع استمرار تطور FICONTER، سنبقي مستخدمينا على اطلاع بالتغييرات المهمة التي قد تؤثر في تجربتهم.",
    "A transparência é uma parte importante da forma como trabalhamos. À medida que a FICONTER continua a evoluir, manteremos os nossos utilizadores informados sobre alterações relevantes que possam afetar a sua experiência.",
    "La trasparenza è una parte importante del nostro modo di operare. Con l'evoluzione di FICONTER, terremo i nostri utenti informati sui cambiamenti significativi che potrebbero influire sulla loro esperienza.",
    "Прозрачность — важная часть нашей работы. По мере развития FICONTER мы будем информировать пользователей о существенных изменениях, которые могут повлиять на их опыт использования.",
  ),
  "If a future change materially affects how financial information is handled, we will communicate that change clearly rather than introducing it without notice.": row(
    "Sollte eine künftige Änderung die Verarbeitung von Finanzinformationen wesentlich beeinflussen, werden wir darüber klar informieren, anstatt sie ohne vorherigen Hinweis einzuführen.",
    "Si un cambio futuro afecta de forma significativa a cómo se gestiona la información financiera, lo comunicaremos con claridad en lugar de introducirlo sin previo aviso.",
    "Nëse një ndryshim i ardhshëm ndikon në mënyrë thelbësore te mënyra se si trajtohet informacioni financiar, do ta komunikojmë qartë atë ndryshim në vend që ta zbatojmë pa njoftim.",
    "إذا أثّر أي تغيير مستقبلي بشكل جوهري في كيفية التعامل مع المعلومات المالية، فسوف نوضح هذا التغيير بوضوح بدلاً من إدخاله دون إشعار.",
    "Se uma alteração futura afetar de forma material a forma como a informação financeira é tratada, comunicaremos essa alteração de forma clara em vez de a introduzir sem aviso.",
    "Se una modifica futura inciderà in modo sostanziale sulla gestione delle informazioni finanziarie, la comunicheremo chiaramente anziché introdurla senza preavviso.",
    "Если будущие изменения существенно повлияют на обработку финансовой информации, мы сообщим об этом ясно и заранее, а не внедрим их без уведомления.",
  ),
  "Thank you for being part of FICONTER.": row(
    "Vielen Dank, dass Sie Teil von FICONTER sind.",
    "Gracias por formar parte de FICONTER.",
    "Faleminderit që jeni pjesë e FICONTER.",
    "شكرًا لكونك جزءًا من FICONTER.",
    "Obrigado por fazer parte da FICONTER.",
    "Grazie per far parte di FICONTER.",
    "Спасибо, что вы с FICONTER.",
  ),
  "This notice closes automatically after 15 seconds.": row(
    "Dieser Hinweis schließt sich nach 15 Sekunden automatisch.",
    "Este aviso se cierra automáticamente después de 15 segundos.",
    "Ky njoftim mbyllet automatikisht pas 15 sekondash.",
    "سيُغلق هذا الإشعار تلقائيًا بعد 15 ثانية.",
    "Este aviso fecha automaticamente após 15 segundos.",
    "Questo avviso si chiude automaticamente dopo 15 secondi.",
    "Это уведомление автоматически закроется через 15 секунд.",
  ),
  "Countdown paused while pressed. Release to continue.": row(
    "Der Countdown pausiert, solange Sie gedrückt halten. Loslassen, um fortzufahren.",
    "La cuenta atrás se pausa mientras mantienes pulsado. Suelta para continuar.",
    "Numërimi mbrapsht ndalon sa kohë e mbani të shtypur. Lëshojeni për të vazhduar.",
    "يتوقف العدّ التنازلي مؤقتًا أثناء الضغط. حرّر الضغط للمتابعة.",
    "A contagem decrescente fica em pausa enquanto mantém premido. Solte para continuar.",
    "Il conto alla rovescia resta in pausa mentre tieni premuto. Rilascia per continuare.",
    "Обратный отсчёт приостанавливается, пока вы удерживаете нажатие. Отпустите, чтобы продолжить.",
  ),
} satisfies Record<string, TranslationRow>);
