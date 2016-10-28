(function (scope, factory) {
    if (typeof define === "function" && define.amd) {
        define(function(){
            return factory();
        });

    } else if (typeof module === "object" && module.exports) {
        module.exports = function() {
            return factory();
        };

    } else {
        scope.taskm = factory();
    }
}(this, function () {
    "use strict";

    var s =
    {
        events : null,
        each : function(object, callback)
        {
            for(var i in object){
                if (!object.hasOwnProperty(i)) {
                    continue;
                }

                var op = callback.call(object[i], i, object[i]);

                if (op === false) {
                    break;
                }
            }
        },
        needFunction : function(toCheck, msg)
        {
            if (!s.isFunction(toCheck)) {
                throw(msg);
            }

            return;
        },
        isNull : function(toCheck)
        {
            if (toCheck === null) {
                return true;
            }

            return false;
        },
        isFunction : function(toCheck)
        {
            if (typeof toCheck === "function") {
                return true;
            }

            return false;
        },
        isString : function(toCheck)
        {
            if (typeof toCheck === "string") {
                return true;
            }

            return false;
        },
        callAll : function(func, context)
        {
            var args = Array.prototype.slice.call(arguments);
            var func = args.shift();
            var context = args.shift();

            for(var i in func){
                func[i].apply(context, args);
            }

            return;
        },
        uuid : function()
        {
            var d = new Date().getTime();

            if(window.performance && typeof window.performance.now === "function"){
                d += performance.now();
            }

            var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
                var r = (d + Math.random()*16)%16 | 0;
                d = Math.floor(d/16);
                return (c=="x" ? r : (r&0x3|0x8)).toString(16);
            });

            return uuid;
        },
    };

    function ResultsTable()
    {
        var t = this;
        var p =
        {
            waiters : {}
        };

        t.wait = function(name, waiter)
        {
            if (p.waiters[name] === undefined) {
                p.waiters[name] = [];
            }

            p.waiters[name].push(waiter);
        }

        t.add = function(result)
        {
            var name = result.getName();

            if (p.waiters[name] !== undefined) {
                s.each(p.waiters[name], function(i, waiter){
                    waiter.call(t, result);
                });

                p.waiters[name] = [];
            }
        }
    }

    function Events(context)
    {
        var t = this;
        var p =
        {
            events : {},
            context
        };

        t.on = function(event, callback)
        {
            if (p.events[event] === undefined) {
                p.events[event] = [];
            }

            p.events[event].push(callback);
        }

        t.trigger = function(event, context)
        {
            var args = Array.prototype.slice.call(arguments);

            if (context === undefined && p.context !== undefined) {
                context = p.context;
            }

            if (context === undefined) {
                throw("Context of callback can not be undefined");
            }

            args.shift();
            args.shift();

            if (p.events[event] === undefined) {
                // there are no collbacks attached to that event
                return;
            }

            s.each(p.events[event], function(i, callback){
                s.needFunction(callback, "Callback of " + event + " is not function");
                callback.apply(context, args);
            });
        }
    }

    function Queue()
    {
        var t = this;
        var p =
        {
            // wskaznik na pierwsza zaleznosc
            root : null,
            // flaga informujaca czy kolejka zostala zatrzymana
            stoped : false,
            // przetrzymuje liste wykonanych zadan
            resultsTable : new ResultsTable()
        };

        p.init = function()
        {
            p.root = new Dependence(null, t);
        }

        t.task = function(creator)
        {
            p.root.task(creator);
            return t;
        }

        t.stop = function()
        {
            p.stoped = true;
            return t;
        }

        t.isStoped = function()
        {
            return p.stoped === true;
        }

        t.wait = function(name, waiter)
        {
            p.resultsTable.wait(name, waiter);
            return t;
        }

        t.registerResult = function(result)
        {
            p.resultsTable.add(result);
            return t;
        }

        t.onError = function(callback)
        {
            p.root.onError(callback);
            return t;
        }

        t.onLoad = function(callback)
        {
            p.root.onLoad(callback);
            return t;
        }

        t.onSuccess = function(callback)
        {
            p.root.onSuccess(callback);
            return t;
        }

        t.run = function(complete)
        {
            p.root.run(complete);
        }

        p.init();
    }

    function Results()
    {
        var t = this;
        var p =
        {
            results : [],
        };

        t.addResult = function(result)
        {
            p.results.push(result);
            return t;
        }

        t.isError = function()
        {
            for(var i in p.results){
                if (p.results[i].isError()) {
                    return true;
                }
            }

            return false;
        }

        t.getErrors = function()
        {
            var errors = new Results();

            for(var i in p.results){
                if (p.results[i].isError()) {
                    errors.addResult(p.results[i]);
                }
            }

            return errors;
        }

        t.getByName = function(name)
        {
            var resultWithName = null;

            s.each(p.results, function(i, result){
                if (result.getName() === name) {
                    resultWithName = result;
                    return false;
                }
            });

            return resultWithName;
        }

        t.getAll = function()
        {
            return p.results;
        }

        t.each = function(callback)
        {
            s.each(p.results, function(i, result){
                callback.call(result, result.getName(), result);
            });

            return t;
        }

        t.getSuccess = function()
        {
            var success = new Results();

            for(var i in p.results){
                if (!p.results[i].isError()) {
                    success.addResult(p.results[i]);
                }
            }

            return success;
        }
    }

    function Result(data, task, error)
    {
        var t = this;
        var p =
        {
            data : data,
            task : task,
            error : error,
        };

        t.isError = function()
        {
            return p.error === true;
        }

        t.get = function(name)
        {
            if (name === undefined) {
                return p.data;
            }

            if (s.isString(p.data)) {
                return p.data;
            }

            if (p.data[name] !== undefined) {
                return p.data[name];
            }

            return null;
        }

        t.getName = function()
        {
            return p.task.getName();
        }

        t.isNamed = function()
        {
            return p.task.isNamed();
        }
    }

    function Task(dependence, queue)
    {
        var t = this;
        var p =
        {
            // dane dla zadania
            data : {},
            // nazwa zadania
            name : s.uuid(),
            named : false,
            // zaleznosc zadania
            dependences : [],
            // zaleznosc nadzedna
            dependence : dependence,
            // funkcja wykonujaca zadanie
            execute : null,
            // referencja do kolejki
            queue : queue,
            // opuznienie wykonania zadania
            timeout : null,

            // zdarzenia w obrembie zadania
            events : new Events(t),

            // defaultowa funckja kontrolujaca zadanie
            control : function(result, next){
                // nic nierobimy puszczamy dalej
                next();
            },
        };

        /**
         * Ustawia funkcje wykonujaca zadanie.
         *
         * @param {Function} execute Podana funkcja zostanie wykonana w
         * momencie realizacji zadania.
         */
        t.execute = function(execute)
        {
            s.needFunction(execute, "execute must be function");
            p.execute = execute;
            return t;
        }

        t.setName = function(name)
        {
            p.name = name;
            p.named = true;
            return t;
        }

        t.isNamed = function()
        {
            return p.named === true;
        }

        t.getName = function()
        {
            return p.name;
        }

        t.dependence = function(creator)
        {
            if (creator instanceof Queue) {


            }else{
                var dependence = new Dependence(t, p.queue);

                s.needFunction(creator, "Creator of dependence must be function.");
                p.dependences.push(dependence);

                creator.call(dependence);
            }

            return t;
        }

        t.setTimeout = function(timeout)
        {
            p.timeout = timeout;
            return t;
        }

        t.getDependences = function()
        {
            return p.dependences;
        }

        t.stop = function()
        {
            p.queue.stop();
            return t;
        }

        t.onLoad = function(onLoad)
        {
            p.events.on("onLoad", onLoad);
            return t;
        }

        t.onError = function(onError)
        {
            p.events.on("onError", onError);
            return t;
        }

        t.onSuccess = function(onSuccess)
        {
            p.events.on("onSuccess", onSuccess);
            return t;
        }

        t.onBefore = function(onBefore)
        {
            p.events.on("onBefore", onBefore);
            return t;
        }

        t.set = function(name, value)
        {
            if (s.isString(name)) {
                p.data[name] = value;
            }else if(name instanceof Results){
                name.each(function(i, result){
                    if (result.isNamed()) {
                        p.data[result.getName()] = result;
                    }
                });
            }else{
                s.each(name, function(name, value){
                    p.data[name] = value;
                });
            }

            return t;
        }

        t.get = function(name)
        {
            if (s.isString(p.data)) {
                // wartosc jest zdefiniowana jako tekst
                return p.data;
            }

            if (name !== undefined) {
                // odwolanie po kluczu
                if (p.data[name] !== undefined) {
                    // jest obiekt z danych
                    var value = p.data[name];

                    if (value instanceof Result) {
                        // obiekt jest Result, wiec z Resulta wyciagam dane
                        return value.get();
                    }else{
                        // obiekt jest czyms innym
                        return value;
                    }
                }else{
                    // brak takiego indexu
                    return undefined;
                }
            }

            // zwracamy wszystkie dane
            var data = {};
            s.each(p.data, function(name, value){
                if (value instanceof Result) {
                    data[name] = value.get();
                }else{
                    data[name] = value;
                }
            });

            return data;
        }

        t.control = function(control)
        {
            p.control = control;
            return t;
        }

        t.run = function(complete)
        {
            // zaleznosci zadania
            var dependences = t.getDependences();
            var count = dependences.length;

            var check = function()
            {
                if (count > 0) {
                    return;
                }

                p.executeTask(function(result){

                    if (result.isError()) {
                        p.events.trigger("onError", t, result);
                        s.events.trigger("onError", t, result);
                    }else{
                        p.events.trigger("onSuccess", t, result);
                        s.events.trigger("onSuccess", t, result);
                    }

                    if (p.queue.isStoped()) {
                        return;
                    }

                    p.events.trigger("onLoad", t, result);
                    s.events.trigger("onLoad", t, result);

                    if (p.queue.isStoped()) {
                        return;
                    }

                    p.queue.registerResult(result);

                    p.control.call(t, result, function(){
                        complete(result);
                    });
                });
            }

            if (count > 0) {
                dependences.map(function(dependence){
                    dependence.run(function(){
                        count--;
                        check();
                    });
                });
            }else{
                check();
            }
        }

        p.executeTask = function(complete)
        {
            if (s.isNull(p.execute)) {
                throw("The task " + t.getName() + " can not be execute because execute function is not defined.");
            }

            var executeTask = function()
            {
                // p.events.trigger("onBefore", t);
                // s.events.trigger("onBefore", t);

                // if (p.queue.isStoped()) {
                //     return;
                // }

                p.execute.call(t, function(data, fail){
                    data = data === undefined ? {} : data;
                    fail = fail === undefined ? false : fail;
                    complete(new Result(data, t, fail));
                });
            }

            if (!s.isNull(p.timeout)) {
                setTimeout(function() {
                    executeTask();
                }, p.timeout);
            }else{
                executeTask();
            }
        }
    }

    function Dependence(task, queue)
    {
        var t = this;
        var p =
        {
            // zadanie nadrzedne
            task : task,
            // referencja do kolejki
            queue : queue,
            // zarzadzanie zdarzeniami
            events : new Events(t),
            // lista zadan jaki musza byc wykonane w ramach zaleznosci
            tasks : [],
            // funckja kontrolujaca
            control : function(results, next){
                var task = this;
                if (this !== null) {
                    results.each(function(name, result){
                        var value = result.get();

                        if (s.isString(value) && result.isNamed()) {
                            task.set(result.getName(), value);
                        }else if(!s.isString(value)){
                            task.set(result.get());
                        }
                    });
                }

                next();
            },
        };

        t.task = function(creator)
        {
            s.needFunction(creator, "Creator of task must be function.");

            var task = new Task(t, p.queue);

            creator.call(task);

            p.tasks.push({
                type : "task",
                task : task,
            });

            return t;
        }

        t.queue = function(queue)
        {
            p.tasks.push({
                type : "queue",
                queue : queue,
            });
        }

        t.wait = function(name)
        {
            p.tasks.push({
                type : "wait",
                name : name,
            });

            return t;
        }

        t.onLoad = function(onLoad)
        {
            p.events.on("onLoad", onLoad);
            return t;
        }

        t.onError = function(onError)
        {
            p.events.on("onError", onError);
            return t;
        }

        t.onSuccess = function(onSuccess)
        {
            p.events.on("onSuccess", onSuccess);
            return t;
        }

        t.stop = function()
        {
            p.queue.stop();
            return t;
        }

        t.control = function(control)
        {
            p.control = control;
            return t;
        }

        t.run = function(complete)
        {
            // pobieram wszystkie zadania ktore sa w tej przestrzeni
            var tasks = p.tasks;
            var count = tasks.length;

            // zmienna przetrzymuje wszystkie resultaty
            var results = new Results();

            var check = function()
            {
                if (count > 0) {
                    // nie wszystkie zadania zostaly wykonane
                    return;
                }

                if (results.isError()) {
                    p.events.trigger("onError", t, results.getErrors());
                    s.events.trigger("onError", t, results.getErrors());
                }else{
                    p.events.trigger("onSuccess", t, results.getSuccess());
                    s.events.trigger("onSuccess", t, results.getSuccess());
                }

                if (p.queue.isStoped()) {
                    return;
                }

                p.events.trigger("onLoad", t, results);
                s.events.trigger("onLoad", t, results);

                if (p.queue.isStoped()) {
                    return;
                }

                // funckja konstrolujaca w przypadku zaleznosci jest wywolywana
                // w kontekscie zadania rodzica
                p.control.call(p.task, results, function(){
                    complete(results);
                });
            }

            if (count > 0) {
                // sa zdefiniowane zadania
                tasks.map(function(task){
                    if (task.type === "task") {
                        task.task.run(function(result){
                            results.addResult(result);
                            count--;
                            check();
                        });
                    }else if(task.type === "wait"){
                        // zadanie czeka az skonczy sie inne zadanie i pojawi
                        // sie w ResultsTable
                        p.queue.wait(task.name, function(result){
                            results.addResult(result);
                            count--;
                            check();
                        });
                    }else if(task.type === "queue"){
                        task.queue.run(function(queueResults){
                            queueResults.each(function(i, result){
                                results.addResult(result);
                                p.queue.registerResult(result);
                                count--;
                                check();
                            });
                        });
                    }
                });
            }else{
                check();
            }
        }
    }

    // attach events to global scope
    s.events = new Events();

    var api =
    {
        on : s.events.on.bind(s.events),
        task : function(creator)
        {
            var queue = new Queue();
            queue.task.call(queue, creator);
            return queue;
        }
    }

    return api;
}));
