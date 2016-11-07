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
        // eventy globalne
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
        isUndefined : function(variable)
        {
            return variable === undefined;
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

    /**
     * Klasa do zarzadzania zdarzeniami.
     */
    function Events(context)
    {
        this.p = {
            // kontener ze zdarzeniami
            events : {},
            // kontekst w ktorym ma byc wywolane zdarzenie
            context : context
        };

        // public
        if (Events.inited === undefined) {
            Events.inited = true;

            Events.prototype.on = function(event, callback)
            {
                if (this.p.events[event] === undefined) {
                    this.p.events[event] = [];
                }

                this.p.events[event].push(callback);
            }

            Events.prototype.trigger = function(event, context)
            {
                var args = Array.prototype.slice.call(arguments);

                if (context === undefined && this.p.context !== undefined) {
                    context = this.p.context;
                }

                if (context === undefined) {
                    throw("Context of callback can not be undefined");
                }

                args.shift();
                args.shift();

                if (this.p.events[event] === undefined) {
                    // there are no collbacks attached to that event
                    return;
                }

                s.each(this.p.events[event], function(i, callback){
                    s.needFunction(callback, "Callback of " + event + " is not function");
                    callback.apply(context, args);
                });
            }
        }
    }

    function Queue()
    {
        this.p =
        {
            // flaga informujaca czy kolejka zostala zatrzymana
            stoped : false,
            waiters : {},
            notified : {},
        };

        if (Queue.inited === undefined) {
            Queue.inited = true;

            Queue.prototype.stop = function()
            {
                // zatrzymanie kole
                this.p.stoped = true;
                return t;
            }

            Queue.prototype.isStoped = function()
            {
                return this.p.stoped === true;
            }

            Queue.prototype.wait = function(name, waiter)
            {
                if (s.isUndefined(this.p.waiters[name])) {
                    this.p.waiters[name] = [];
                }

                this.p.waiters[name].push(waiter);

                this._check();

                return this;
            }

            Queue.prototype.notify = function(name, data)
            {
                this.p.notified[name] = data;

                this._check();

                return this;
            }

            Queue.prototype._check = function()
            {
                var t = this;

                s.each(t.p.notified, function(name, data){
                    if (s.isUndefined(t.p.waiters[name])) {
                        return;
                    }

                    s.each(t.p.waiters[name], function(i, waiter){
                        t.p.waiters[name].splice(i,1);
                        waiter(data);
                    });
                });
            }
        }
    }

    function Task(queue)
    {
        this.p = {
            // wskaznik na kolejke
            queue : queue,
            // kontener na dane ktore mozna ustawic w obrembie danego zadania
            data : {},
            name : s.uuid(),
            isNamed : false,
            // zaleznosc zadania
            dependences : [],
            // done
            dependencesDone : false,
            // funkcja wykonujaca zadanie
            exec : function(resolve, reject){
                resolve(this.get());
            },
            // opuznienie wykonania zadania
            timeout : null,

            // zdarzenia w obrembie zadania
            events : new Events(this),
            // funckja wykonywana na bledzie
            error : function(data, repair, resolve){
                throw("Not catch task error "+data);
            },
        };

        // public
        if (Task.inited === undefined) {
            Task.inited = true;

            /**
             * Ustawia funkcje wykonujaca zadanie.
             *
             * @param {function} exec Funkcja jest wykonana gdy zadanie ma byc
             * wykonane. Funkcja jest wywolywana z parametrem resolve, oraz
             * reject.
             *
             * @return {self}
             */
            Task.prototype.exec = function(exec)
            {
                this.p.exec = exec;
                return this;
            }

            Task.prototype.get = function(name)
            {
                if (name !== undefined) {
                    if (this.p.data[name] !== undefined) {
                        return this.p.data[name];
                    }else{
                        return undefined;
                    }
                }

                return this.p.data;
            }

            Task.prototype.set = function(name, value)
            {
                var t = this;
                if (s.isString(name)) {
                    this.p.data[name] = value;
                    return this;
                }

                s.each(name, function(name, value){
                    t.p.data[name] = value;
                });

                return this;
            }

            /**
             * Ustawia nazwe zadania.
             * @param {string} name Nazwa zadania.
             *
             * @return {self}
             */
            Task.prototype.setName = function(name)
            {
                this.p.name = name;
                this.p.isNamed = true;
                return this;
            }

            /**
             * Zwraca informacje czy dane zadanie zostalo nazwane.
             *
             * @return {boolean}
             */
            Task.prototype.isNamed = function()
            {
                return this.p.isNamed === true;
            }

            Task.prototype.getName = function()
            {
                return this.p.name;
            }

            Task.prototype.on = function(event, callback)
            {
                this.p.events.on(event, callback);
                return this;
            }

            /**
             * Ustawia funkcje wykonywana w momencie bledu.
             *
             * @param {function} error Funkcja jest wykonana gdy zadanie nie
             * zostanie wykonane.
             *
             */
            Task.prototype.error = function(error)
            {
                this.p.error = error;
                return this;
            }

            Task.prototype.task = function(creatorOrName)
            {
                if (s.isString(creatorOrName)) {
                    // tworzenie zaleznosci od calkowicie innego zadania z
                    // innej galezi
                    this.p.dependences.push({
                        type : 'wait',
                        to : creatorOrName
                    });

                    return null;
                }

                // tworzymy zadanie
                var task = new Task(this.p.queue);

                if (s.isFunction(creatorOrName)) {
                    task.creator(creatorOrName);
                }

                this.p.dependences.push({
                    type : 'task',
                    task : task,
                });

                return task;
            }

            Task.prototype.creator = function(creator)
            {
                creator.call(this);
                return this;
            }

            Task.prototype.then = function(then)
            {
                var t = this;

                // pobieram wszystkie zalezne zadania
                var dependences = this.p.dependences;

                // jesli przy zadaniu byl blad, a zaleznosci zostaly juz
                // wykonane, wiec nie wykonujemy ich jeszcze raz
                if (this.p.dependencesDone) {
                    dependences = [];
                }

                // zliczam ilosc tych zadan
                var count = dependences.length;

                // jesli zadanie jest zalezne to przetrzymuje wynik jego
                // dzialania
                var results = {};

                // funkcja sprawdzajaca czy wszystkie zadania zostaly juz
                // wykone
                var check = function(){
                    if (count > 0) {
                        return;
                    }

                    if (t.p.dependencesDone === false) {
                        // jest to zabezpieczenie ze wynik zaleznosci zostanie
                        // wpisany tylko za pierwszym razem, jesli zostanie
                        // uruchomiony proces repair, to nie spowoduje to
                        // ponownego wywolania wszystkich zadan zaleznych
                        t.set(results);
                    }

                    // wszystkie zaleznosci zostaly juz wykonane,
                    t.p.dependencesDone = true;

                    // funckja wykonana gdy bazowe zadanie zostanie poprawnie
                    // zakonczone
                    var resolve = function(data){
                        // od razu przekazujemy dane do then
                        t.p.queue.notify(t.getName(), data);
                        then.call(t, data);
                    }

                    // repair wywoluje jeszcze raz procedure exec
                    var repair = function(){
                        t.then(then);
                    }

                    // funckja wykonana gdy bazowe zadanie zostanie blednie
                    // zakonczone
                    var reject = function(data){
                        // wywoluje funkje do obslugi bledu
                        t.p.error.call(t, data, repair, resolve);
                    }

                    try{
                        t.p.exec.call(t, resolve, reject);
                    }catch(e){
                        t.p.error.call(t, e, repair, resolve);
                    }
                }

                if (count > 0) {
                    // sa zadania
                    dependences.map(function(task){
                        if (task.type == 'wait') {
                            t.p.queue.wait(task.to, function(data){
                                if (!s.isUndefined(data)) {
                                    results[task.to] = data;
                                }

                                count--;
                                check();
                            });
                        }else if(task.type == 'task'){
                            task.task.then(function(data){
                                if (this.isNamed()) {
                                    // jesli zadanie ma nazwe to wynik jest
                                    // przekazywany do zadania nadrzednego
                                    if (!s.isUndefined(data)) {
                                        results[this.getName()] = data;
                                    }
                                }

                                count--;
                                check();
                            });

                        }
                    });

                }else{
                    check();
                }

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
            var task = new Task(new Queue());

            if (s.isFunction(creator)) {
                task.creator(creator);
            }

            return task;
        },
    }

    return api;
}));
