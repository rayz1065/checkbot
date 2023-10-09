-bot-name = checkbot
-bot-creator = @rayz1065
-bot-github = https://github.com/rayz1065/checkbot/
-schwa = ə

# base

-emoji-cancel = ❌
-emoji-back = 🔙
-emoji-confirm = ✅
cancel = Annulla {-emoji-cancel}
back = Indietro {-emoji-back}
back-to-menu = Torna al menù {-emoji-back}
confirm = Conferma {-emoji-confirm}
no-operation-running = Nessuna operazione in corso...
write-cancel-to-cancel-operation = Scrivi /cancel per annullare
unknown-error = Errore sconosciuto

share = Condividi
enter-bot = Entra in {$bot-name}
join-bot =
    Crea le tue <b>checklist private</b> con @{$bot-name}!

    💬 Funziona nei gruppi, canali, conversazioni private, e nella chat con il bot
    😶‍🌫️ Non salva in nessun modo le tue checklist che rimangono unicamente su telegram!

config-btn = ⚙️ Configura 🌐
config = configurazione
default-checked-box = Checkbox di base
default-unchecked-box = Box senza check di base
if-a-box-is-present-bot-will-prefer = Se un box è presente nel messaggio, il bot preferirà usare quello
default-already-set = Questa è già la scelta di base
language-already-set = Questa lingua è già impostata
updated-preference = Preferenze aggiornate
updated-language = Lingua aggiornata

welcome-message = 👋 Ciao <b>{$user-name}</b>, benvenut{-schwa} su {$bot-name}!

    {$bot-name} funziona <b>ovunque</b>:
    👥 Aggiungimi ad un gruppo e usa l'hashtag #check o il comando /check
    📺 Modificherò rapidamente le checklist inviate e modificate che contengono #check
    ↩️ Usami in modalità inline in qualsiasi conversazione
    🤖 Invia semplicemente un messaggio contenente "-" o ✅ in questa chat

    😶‍🌫️ <i>Nessuna delle tue checklist viene salvata in alcun modo, rimangono semplicemente su telegram!</i>

    Provalo! Tocca sul messaggio qua sotto per copiarlo, poi invialo in questa chat:
    <code>- Tocca sul box a sinistra per aggiungere un check
    ✅ Il primo box con una check detterà lo stile in tutto il messaggio
    ☑️ Puoi cambiare quello di base premendo su {config-btn}
    </code>

done-press-back = Fatto, clicca indietro per tornare alla chat

help-btn = Aiuto 🆘
need-help-with-the-bot = Ti serve una mano con il bot?
contact-me = Contattami {-bot-creator}

add-to-group = Aggiungimi ad un gruppo 👥
info = Info ℹ️
use-inline = Modalità mode ↩️

generating-links = Genero i link
shared-checklist = Checklist condivisa
personal-checklist = Checklist personale
you-must-start-for-inline-mode = Devi avviare il bot perché possa funzionare in modalità inline
use-text-to-recreate-checklist = Puoi usare il testo qua sotto per ricreare la tua checklist
you-must-start-for-protected-content = Devi avviare il bot perché possa funzionare in in gruppo con contenuti protetti

click-here-to-start = Clicca qui per avviare il bot
error-creating-checklist = C'è stato un errore nel creare la checklist

no-rights-to-edit-group-checklist =
    Non hai i permessi per modificare questa checklist (magari sei un amministratore anonimo, magari il bot non ha accesso alla lista degli membri della chat, rendi il bot amministratore per risolvere)
you-are-not-administrator = Non sei amministratore di questo canale e non puoi modificare le checklist
no-rights-to-edit-checklist = Non hai i permessi per modificare questa checklist
checklist-is-personal = Questa checklist è personale e solo l'autor{-schwa} può modificarla, usa una checklist condivisa per permettere a tutt{-schwa} di modificarla

failed-to-read-checklist-error = Non sono riuscito a leggere i contenuti della checklist per un errore: <code>{$message}</code>
failed-to-read-checklist-unknown = Non sono riuscito a leggere i contenuti della checklist per un errore ignoto
failed-to-read-checklist = Non sono riuscito a leggere i contenuti della checklist

info-message =
    🧑‍💻 Sviluppatore: @rayz1065
    🗃 Codice sorgente: github.com/rayz1065/checkbot
    📄 Licenza: <a href="https://www.gnu.org/licenses/agpl-3.0.en.html">GNU Affero General Public License</a>

    🤖 Questo bot è scritto in TypeScript e usa il framework <a href="https://grammy.dev/">grammY</a>

help-command-tip = Chiedi aiuto per il bot
config-command-tip = Imposta le tue preferenze, cambia la lingua
check-command-tip = Crea una checklist in un gruppo

bot-name = Checklist Bot ✅

bot-description =
    👥 Aggiungimi ad un gruppo e usa l'hashtag #check o il comando /check
    📺 Modificherò rapidamente le checklist inviate e modificate che contengono #check
    ↩️ Usami in modalità inline in qualsiasi conversazione
    🤖 Invia semplicemente un messaggio contenente "-" o ✅ in questa chat

    😶‍🌫️ Nessuna delle tue checklist viene salvata in alcun modo, rimangono semplicemente su telegram!

bot-short-description =
    😶‍🌫️ Crea checklist interamente private
    🧑‍💻 Sviluppatore: @rayz1065
    🗃 Codice: https://github.com/rayz1065/checkbot

check-command-usage =
    Per usare questo comando scrivi semplicemente:
    <code>/check
    - Un elemento senza check
    - [ ] Anche questo è senza check
    ✅ Un elemento con il check
    - [x ] Puoi mettere una x in qualunque posto nel box
    </code>

    Questo comando dovrebbe essere usato nei gruppi, nella chat privata invia semplicemente un messaggio con una checklist.

never-show-again = Non mostrare più 🌫
show-edit-confirmation = Mostra conferma di modifica 💬
i-will-not-show-again = Non mostrerò più questo messaggio 🌫
you-can-show-again-in-config = Puoi mostrarlo di nuovo nelle configurazioni scrivendo /config

validation-photo-required = Una foto è richiesta
validation-string-length = Invia una stringa tra {$min} e {$max} caratteri
validation-send-valid-number = Invia un numero valido
invalid-choice = Scelta non valida
