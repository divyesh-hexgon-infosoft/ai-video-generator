const promptRouter = require('../routes/prompt.routes');
class RoutesLoader {
    static initRoutes (app) {
        app.use(`/api/prompt`, promptRouter);
    }
}


module.exports = RoutesLoader;

