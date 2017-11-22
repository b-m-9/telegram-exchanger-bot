## TelegramBot: http://t.me/topexchangerbot
**for service https://proexchanger.net/telegram**

## Insall
```
npm install "git+https://github.com/medve-dev/telegram-exchanger-bot.git" --save
```

## USE bot:
```
node index.js
```
or (soon)
```
const telegram_exchanger_bot = require('telegram-exchanger-bot');
const exchangerBot = new telegram_exchanger_bot(__YOU_TOKEN__,{ttl:3600,refresh_interval:1});
// add router
exchangerBot.router.on('example_callback', ctx => {
    return ctx.reply('Test Message and button:', 
        exchangerBot.Extra.HTML()
        .markup(m => m.inlineKeyboard([m.callbackButton('exampleBTN', `example_callback_btn:param1`)], {columns: 2}))
    );
});

```




use Rest-API (proexchanger): https://proexchanger.net/api/v1/public_get_list_monitoring_exchanger

### Example result:
```

{
result: [
  {
      _id: "59ff4e06dacf3714f804d969",
      link: "https://100btc.pro/?rid=2188",
      xml: "https://100btc.pro/request-exportxml.xml",
      website: "https://100btc.pro",
      name: "100Btc"
  }, ...more...
],
success: true,
latency_ms: 80,
requestId: "1511339667451-QT01GvK",
demo_api_auth_not_serure: true
}
```
