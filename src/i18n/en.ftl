-bot-name = checkbot
-bot-creator = @rayz1065
-bot-github = https://github.com/rayz1065/checkbot/

cancel = Cancel {$emoji-cancel}
back = Back {$emoji-back}
back-to-menu = Back to menu {$emoji-back}
confirm = Confirm {$emoji-confirm}
no-operation-running = No operation is running...
write-cancel-to-cancel-operation = Write /cancel to cancel operation

share = Share
enter-bot = Join {$bot-name}
join-bot =
    Join @{$bot-name} to create your <b>private checklists</b>!

    💬 Works in groups, channels, private conversations, and the chat with the bot
    😶‍🌫️ Does not save in any way your checklists which remain only on telegram!

config-btn = ⚙️ Config 🌐
config = config
default-checked-box = Default checked box
default-unchecked-box = Default unchecked box
if-a-box-is-present-bot-will-prefer = If a box is present in the message, the bot will prefer that one
default-already-set = This is already the default
language-already-set = This language is already set
updated-preference = Updated preference
updated-language = Updated language

welcome-message = 👋 Hello <b>{$user-name}</b>, welcome to {$bot-name}!

    {$bot-name} works <b>everywhere</b>:
    👥 Add me to a group and use the hashtag #check or the /check command
    📺 I will quickly edit sent and edited checklists in channels containing #check
    ↩️ Use me in inline mode in any conversation
    🤖 Just send a message containing "-" or ✅ in this chat

    😶‍🌫️ <i>None of your checklists are stored in any way, they only remain on telegram!</i>

    Try it! Touch on the text below to copy it, then send it in this chat:
    <code>- Press on the box on the left to add a check
    ✅ The first check will decide the style for the whole message
    ☑️ You can change the default one clicking on {config-btn}
    </code>

done-press-back = Done, press back to return to the chat

help-btn = Help 🆘
need-help-with-the-bot = Need help with the bot?
contact-me = Contact me {-bot-creator}

add-to-group = Add me to a group 👥
info = Info ℹ️
use-inline = Inline mode ↩️

info-message =
    🧑‍💻 Developer: @rayz1065
    🗃 Source: github.com/rayz1065/checkbot
    📄 License: <a href="https://www.gnu.org/licenses/agpl-3.0.en.html">GNU Affero General Public License</a>

    🤖 This bot is written in TypeScript and is based on the framework <a href="https://grammy.dev/">grammY</a>

help-command-tip = Request help for the bot
config-command-tip = Set your preferences, change your language
check-command-tip = Create a new checklist in a group

bot-name = Checklist Bot ✅

bot-description =
    👥 Add me to a group and use the hashtag #check or the /check command
    📺 I will quickly edit sent and edited checklists in channels containing #check
    ↩️ Use me in inline mode in any conversation
    🤖 Just send a message containing "-" or ✅ in this chat

    😶‍🌫️ None of your checklists are stored in any way, they only remain on telegram!

bot-short-description =
    😶‍🌫️ Create completely private checklists
    🧑‍💻 Developer: @rayz1065
    🗃 Source: https://github.com/rayz1065/checkbot

check-command-usage =
    To use this command simply write:
    <code>/check
    - An unchecked item
    - [ ] Also an unchecked item
    ✅ A checked item
    - [x ] You can put an x anywhere in the box
    </code>

    This command should be used in groups, in the private chat you can simply send a message containing a checklist.

validation-photo-required = A photo is required
validation-string-length = Send a string between {$min} and {$max} characters
validation-send-valid-number = Send a valid number
invalid-choice = Invalid choice
