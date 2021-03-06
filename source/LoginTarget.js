import isVisible from "is-visible";
import EventEmitter from "eventemitter3";
import { getSharedObserver as getUnloadObserver } from "./UnloadObserver.js";
import { setInputValue } from "./inputs.js";

export const FORCE_SUBMIT_DELAY = 7500;

function getEventListenerForElement(type) {
    switch (type) {
        case "form":
            return "submit";
        case "submit":
            return "click";
        case "username":
        /* falls-through */
        case "password":
        /* falls-through */
        default:
            return "input";
    }
}

/**
 * The LoginTarget class which represents a 'target' for logging in
 * with some credentials
 * @class LoginTarget
 */
export default class LoginTarget extends EventEmitter {
    constructor() {
        super();
        this.baseScore = 0;
        this._form = null;
        this._usernameField = null;
        this._passwordField = null;
        this._submitButton = null;
        this._forceSubmitDelay = FORCE_SUBMIT_DELAY;
        this._changeListeners = {
            username: null,
            password: null,
            submit: null,
            form: null
        };
    }

    /**
     * Delay in milliseconds that the library should wait before force submitting the form
     * @type {Number}
     * @memberof LoginTarget
     */
    get forceSubmitDelay() {
        return this._forceSubmitDelay;
    }

    /**
     * The target login form
     * @type {HTMLFormElement}
     * @memberof LoginTarget
     */
    get form() {
        return this._form;
    }

    /**
     * The password input element
     * @type {HTMLInputElement|null}
     * @memberof LoginTarget
     */
    get passwordField() {
        return this._passwordField;
    }

    /**
     * The submit button element
     * @type {HTMLInputElement|HTMLButtonElement|null}
     * @memberof LoginTarget
     */
    get submitButton() {
        return this._submitButton;
    }

    /**
     * The username input element
     * @type {HTMLInputElement|null}
     * @memberof LoginTarget
     */
    get usernameField() {
        return this._usernameField;
    }

    set forceSubmitDelay(delay) {
        this._forceSubmitDelay = delay;
    }

    set form(form) {
        if (form) {
            this._form = form;
            this._listenForUpdates("form", form);
        }
    }

    set passwordField(field) {
        if (field) {
            this._passwordField = field;
            this._listenForUpdates("password", field);
        }
    }

    set submitButton(button) {
        if (button) {
            this._submitButton = button;
            this._listenForUpdates("submit", button);
        }
    }

    set usernameField(field) {
        if (field) {
            this._usernameField = field;
            this._listenForUpdates("username", field);
        }
    }

    /**
     * Calculate the score of the login target
     * This can be used to compare LoginTargets by their likelihood of being
     * the correct login form. Higher number is better.
     * @returns {Number} The calculated score
     * @memberof LoginTarget
     */
    calculateScore() {
        let score = this.baseScore;
        score += this.usernameField ? 10 : 0;
        score += this.passwordField ? 10 : 0;
        score += this.submitButton ? 10 : 0;
        if (isVisible(this.form)) {
            score += 10;
        }
        return score;
    }

    /**
     * Fill username into the username field.
     * @param {String} username The username to enter
     * @returns {Promise} A promise that resolves once the data has been entered
     * @memberof LoginTarget
     * @example
     *      loginTarget.fillUsername("myUsername")
     */
    fillUsername(username) {
        if (this.usernameField) {
            setInputValue(this.usernameField, username);
        }
        return Promise.resolve();
    }

    /**
     * Fill password into the password field.
     * @param {String} password The password to enter
     * @returns {Promise} A promise that resolves once the data has been entered
     * @memberof LoginTarget
     * @example
     *      loginTarget.fillPassword("myPassword")
     */
    fillPassword(password) {
        if (this.passwordField) {
            setInputValue(this.passwordField, password);
        }
        return Promise.resolve();
    }

    /**
     * Enter credentials into the form without logging in
     * @param {String} username The username to enter
     * @param {String} password The password to enter
     * @returns {Promise} A promise that resolves once the data has been entered
     * @memberof LoginTarget
     * @example
     *      loginTarget.enterDetails("myUsername", "myPassword");
     */
    enterDetails(username, password) {
        return Promise.all([this.fillUsername(username), this.fillPassword(password)]);
    }

    /**
     * Login using the form
     * Enters the credentials into the form and logs in by either pressing the
     * login button or by submitting the form. The `force` option allows for
     * trying both methods: first by clicking the button and second by calling
     * `form.submit()`. When using `force=true`, if clicking the button doesn't
     * unload the page in `target.forceSubmitDelay` milliseconds,
     * `form.submit()` is called. If no form submit button is present, `force`
     * does nothing as `form.submit()` is called immediately.
     * @param {String} username The username to login with
     * @param {String} password The password to login with
     * @param {Boolean=} force Whether or not to force the login (defaults to
     *  false)
     * @returns {Promise} A promise that resolves once the login procedure has
     * completed. Let's be honest: there's probably no point to listen to the
     * return value of this function.
     * @memberof LoginTarget
     * @example
     *      loginTarget.login("myUsername", "myPassword");
     */
    login(username, password, force = false) {
        return this.enterDetails(username, password).then(() => this.submit(force));
    }

    /**
     * Submit the associated form
     * You probably don't want this function. `login` or `enterDetails` are way
     * better.
     * @param {Boolean=} force Force the submission (defaults to false)
     * @memberof LoginTarget
     */
    submit(force = false) {
        if (!this.submitButton) {
            // No button, just try submitting
            this.form.submit();
            return Promise.resolve();
        }
        // Click button
        this.submitButton.click();
        return force ? this._waitForNoUnload() : Promise.resolve();
    }

    /**
     * Attach an event listener to listen for input changes
     * Attaches listeners for username/password input changes and emits an event
     * when a change is detected.
     * @param {String} type The type of input (username/password)
     * @param {HTMLInputElement} input The target input
     * @fires LoginTarget#valueChanged
     * @fires LoginTarget#formSubmitted
     */
    _listenForUpdates(type, input) {
        if (/username|password|submit|form/.test(type) !== true) {
            throw new Error(`Failed listening for field changes: Unrecognised type: ${type}`);
        }
        // Detect the necessary event listener name
        const eventListenerName = getEventListenerForElement(type);
        // Check if a listener exists already, and clear it if it does
        if (this._changeListeners[type]) {
            const { input, listener } = this._changeListeners[type];
            input.removeEventListener(eventListenerName, listener, false);
        }
        // Emit a value change event
        let handleEvent;
        if (type === "submit" || type === "form") {
            // Listener function for the submission of the form
            const source = type === "form" ? "form" : "submitButton";
            handleEvent = () => this.emit("formSubmitted", { source });
        } else {
            const emit = value => {
                this.emit("valueChanged", {
                    type,
                    value
                });
            };
            // Listener function for the input element
            handleEvent = function() {
                emit(this.value);
            };
        }
        // Store the listener information
        this._changeListeners[type] = {
            input,
            listener: handleEvent
        };
        // Attach the listener
        input.addEventListener(eventListenerName, handleEvent, false);
    }

    /**
     * Wait for either the unload event to fire or the delay to
     * time out
     * @protected
     * @returns {Promise} A promise that resolves once either the delay has
     * expired for the page has begun unloading.
     * @memberof LoginTarget
     */
    _waitForNoUnload() {
        const unloadObserver = getUnloadObserver();
        return Promise.race([
            new Promise(resolve => {
                setTimeout(() => {
                    resolve(false);
                }, this.forceSubmitDelay);
            }),
            new Promise(resolve => {
                if (unloadObserver.willUnload) {
                    return resolve(true);
                }
                unloadObserver.once("unloading", () => {
                    resolve(true);
                });
            })
        ]).then(hasUnloaded => {
            if (!hasUnloaded) {
                // No unload events detected, so we need for force submit
                this.form.submit();
            }
        });
    }
}
