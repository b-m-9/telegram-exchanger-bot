const Telegraf = require('telegraf');
const cloudscraper = require('cloudscraper');
const X2JS = require('x2js');
const config = require('./configbot.json');
const currencies = require('./currencies.json');

const {Router, Extra, memorySession} = require('telegraf');

function getCurrencyName(code) {
    return currencies[code] ? currencies[code].name : code;
}

class ConversionRates {
    constructor(cfg) {
        this.config = cfg;
        this.conversions = {};
        this.exchangers = {};
    }

    static parseFeed(feed, xml) {
        const x2js = new X2JS();
        const parserXML = x2js.xml2js(feed);
        if (!parserXML || !parserXML.rates || !parserXML.rates.item) {
            console.error('errorXML:',xml,parserXML);
            return false;
        }
        return x2js.xml2js(feed).rates.item;
    }

    static loadFeed(url) {
        return new Promise((resolve, reject) => {

            cloudscraper.get(url, (err, res, body) => {
                if (err) reject(err);
                const data = ConversionRates.parseFeed(body,url);
                resolve(data);
            });
        });
    }

    static loadListExchanger(url) {
        return new Promise((resolve, reject) => {
            cloudscraper.get(url, (err, res, body) => {
                if (err) reject(err);
                if(!body) reject('body undefined')
                const data = JSON.parse(body);
                resolve(data.result);
            });
        });
    }

    getCurrencies(from = null) {
        if (!from) {
            return Object.keys(this.conversions);
        }
        return Object.keys(this.conversions[from]);
    }

    getRates(from, to) {
        return this.conversions[from][to];
    }

    getExchangerInfo(index, from, to) {
        return this.exchangers[index][from][to];
    }

    async start() {

    }

    async update() {
        const feeds = await ConversionRates.loadListExchanger('https://proexchanger.net/service/api/v1/public_get_list_monitoring_exchanger');
        const loadedFeeds = await Promise.all(feeds.map( async (feed) => {
            try {
                return {
                    ...feed,
                    rates: await ConversionRates.loadFeed(feed.xml),
                }
            } catch (e) {
                return feed;
            }
        }));
        [ this.conversions, this.exchangers ] = loadedFeeds
            .filter(f => Boolean(f && f.rates && f.rates.length))
            .reduce((accum, feed, index) => {
                const [ conversions, exchangers ] = accum;
                feed.rates.forEach((item) => {
                    if (!conversions[item.from]) {
                        conversions[item.from] = {};
                    }
                    if (!conversions[item.from][item.to]) {
                        conversions[item.from][item.to] = [];
                    }
                    if (!exchangers[index]) {
                        exchangers[index] = {};
                    }
                    if (!exchangers[index][item.from]) {
                        exchangers[index][item.from] = {};
                    }
                    conversions[item.from][item.to].push({
                        exchange: feed.name,
                        index,
                        in: item.in,
                        out: item.out,
                        minamount: item.minamount,
                        amount: item.amount,
                    });
                    exchangers[index][item.from][item.to] = {
                        name: feed.name,
                        link: feed.link,
                        in: item.in,
                        out: item.out,
                        minamount: item.minamount,
                        amount: item.amount,
                    };
                });
                return [conversions, exchangers];
        }, [ {}, {} ]);
        console.log(`Loaded ${Object.keys(this.exchangers).length} sources`);
        return Promise.resolve();
    }
}


(async () => {
    const rates = new ConversionRates(config);
    const bot = new Telegraf(config.tg_token);
    await rates.update();

    function render(ctx) {
        if (!ctx.session.convertFrom) {
            return renderConvertFrom(ctx);
        }
        if (!ctx.session.convertTo) {
            return renderConvertTo(ctx);
        }
        if (!ctx.session.exchangerId) {
            return renderExchangers(ctx);
        }
        renderExchangerInfo(ctx);
    }

    const router = new Router((ctx) => {
        if (!ctx.callbackQuery.data) {
            return Promise.resolve();
        }
        const parts = ctx.callbackQuery.data.split(':');
        return Promise.resolve({
            route: parts[0],
            state: {
                param: parts[1],
            },
        });
    });

    router.on('convertFrom', (ctx) => {
        ctx.session.convertFrom = ctx.state.param;
        return render(ctx);
    });

    router.on('convertTo', (ctx) => {
        ctx.session.convertTo = ctx.state.param;
        return render(ctx);
    });

    router.on('exchangerInfo', (ctx) => {
        ctx.session.exchangerId = ctx.state.param;
        return render(ctx);
    });

    router.on('clear', (ctx) => {
        if (ctx.state.param) {
            const paramsToClear = ctx.state.param.split(',');
            paramsToClear.forEach((param) => {
                delete ctx.session[param];
            });
        } else {
            ctx.session = {};
        }
        return render(ctx);
    });


    function renderConvertFrom(ctx) {
        return ctx.reply('Конвертировать из:', Extra
            .HTML()
            .markup(m => m.inlineKeyboard(
                rates.getCurrencies().map(currency =>
                    m.callbackButton(getCurrencyName(currency), `convertFrom:${currency}`)
                )
                , {columns: 2}))
        );
    }

    function renderConvertTo(ctx) {
        return ctx.editMessageText(`Конвертировать из ${getCurrencyName(ctx.session.convertFrom)} в:`, Extra
            .HTML()
            .markup(m => m.inlineKeyboard(
                rates.getCurrencies(ctx.session.convertFrom).map(currency =>
                    m.callbackButton(getCurrencyName(currency), `convertTo:${currency}`)
                )
                , {columns: 2}))
        );
    }

    function renderExchangers(ctx) {
        // Kassa.cc       | 1 PAYUSD = 55 SBERRUB | Резерв 6000 SBERRUB

        const convertTo = getCurrencyName(ctx.session.convertTo);
        const convertFrom = getCurrencyName(ctx.session.convertFrom);
        return ctx.editMessageText(`Перевод из ${ctx.session.convertFrom} в ${ctx.session.convertTo}`, Extra
            .HTML()
            .markup(m => m.inlineKeyboard(
                rates.getRates(ctx.session.convertFrom, ctx.session.convertTo).map(exch =>
                    m.callbackButton(
                        `${exch.exchange} | ${exch.in} ${convertFrom} = ${exch.out} ${convertTo} | Резерв ${exch.amount} ${convertTo}`,
                        `exchangerInfo:${exch.index}`
                    )
                )
                , {columns: 1}))
        );
    }
    function renderExchangerInfo(ctx) {
        const exchangerInfo = rates.getExchangerInfo(
            ctx.session.exchangerId,
            ctx.session.convertFrom,
            ctx.session.convertTo
        );
        const convertTo = getCurrencyName(ctx.session.convertTo);
        const convertFrom = getCurrencyName(ctx.session.convertFrom);
        const messageText = [
            `Обменник ${exchangerInfo.name}`,
            `Направление ${convertFrom} -> ${convertTo}`,
            `Курс: ${exchangerInfo.in} ${convertFrom} = ${exchangerInfo.out} ${convertTo}`,
            `Резерв: ${exchangerInfo.amount || 0}`,
            '',
        ].join('\n');
        return ctx.editMessageText(messageText, Extra.HTML()
            .markup(m => m.inlineKeyboard([
                    m.urlButton(
                        'Перейти к обмену',
                        exchangerInfo.link
                    ),
                    m.callbackButton(
                        'Другие обменники',
                        'clear:exchangerId'
                    ),
                    m.callbackButton(
                        'Другие направления',
                        'clear'
                    ),

                ], {coumns: 1})
            ));
    }


    bot.use(memorySession({ttl: 3600}));
    bot.on('callback_query', router.middleware());
    bot.command('start', (ctx) => {
        ctx.session = {};
        return renderConvertFrom(ctx);
    });

    bot.startPolling();
})();
