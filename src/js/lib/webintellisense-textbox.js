/// <reference path="webintellisense.ts"/>
// The properties that we copy into a mirrored div.
// Note that some browsers, such as Firefox,
// do not concatenate properties, i.e. padding-top, bottom etc. -> padding,
// so we have to do every single property specifically.
// https://github.com/component/textarea-caret-position
var properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    // https://developer.mozilla.org/en-US/docs/Web/CSS/font
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing'
];
/**
 * Simple data structure for providing a keyboard event to trigger the showing
 * of the DeclarationsIntellisense or MethodsIntellisense user interfaces.
 */
var KeyTrigger = (function () {
    function KeyTrigger() {
    }
    return KeyTrigger;
}());
/**
 * This class provides intellisense for either a textarea or an inputbox.
 * Triggers can be added
 *
 * @param editor The id of a textarea or inputbox or the actual element
 */
var TextBoxIntellisense = (function () {
    function TextBoxIntellisense(editorOrId) {
        var _this = this;
        this.decls = new wi.DeclarationsIntellisense();
        this.meths = new wi.MethodsIntellisense();
        this.triggers = { upDecls: [], downDecls: [], upMeths: [], downMeths: [] };
        this.declarationsCallback = null;
        this.methodsCallback = null;
        this.startColumnIndex = 0;
        this.editor = null;
        this.isFirefox = window.hasOwnProperty('mozInnerScreenX');
        // when the visiblity has changed for the declarations, set the position of the methods UI
        this.decls.onVisibleChanged(function (v) {
            if (v) {
                var coords = _this.getCaretCoordinates(_this.editor, _this.getCaretOffset());
                var x = coords.left + _this.editor.offsetLeft;
                var y = coords.top + _this.editor.offsetTop + 15;
                _this.decls.setPosition(x, y);
            }
        });
        // when the visiblity has changed for the methods, set the position of the methods UI
        this.meths.onVisibleChanged(function (v) {
            if (v) {
                var coords = _this.getCaretCoordinates(_this.editor, _this.getCaretOffset());
                var x = coords.left + _this.editor.offsetLeft;
                var y = coords.top + _this.editor.offsetTop + 15;
                _this.meths.setPosition(x, y);
            }
        });
        // when an item is chosen by the declarations UI, set the value.
        this.decls.onItemChosen(function (item) {
            var itemValue = item.value || item.name;
            var text = _this.editor.value;
            var left = text.substring(0, _this.startColumnIndex);
            var right = text.substring(_this.getCaretOffset());
            _this.editor.value = left + itemValue + right;
            _this.editor.selectionStart = left.length + itemValue.length;
            _this.editor.selectionEnd = left.length + itemValue.length;
            _this.decls.setVisible(false);
        });
        this.setEditor(editorOrId);
    }
    TextBoxIntellisense.prototype.processTriggers = function (triggers, evt, callback) {
        for (var k in triggers) {
            var item = triggers[k];
            var shiftKey = item.shiftKey || false;
            var ctrlKey = item.ctrlKey || false;
            var keyCode = item.keyCode || 0;
            var preventDefault = item.preventDefault || false;
            if (evt.keyCode === keyCode && evt.shiftKey === shiftKey && evt.ctrlKey === ctrlKey) {
                if (evt.keyCode !== 8) {
                    this.startColumnIndex = this.getCaretOffset();
                } else {
                    var lastIndex = this.editor.value.lastIndexOf('.');
                    if (lastIndex !== -1) {
                        this.startColumnIndex = lastIndex + 1;
                    } else {
                        this.startColumnIndex = 0;
                    }
                } 
                callback(item);
                if (preventDefault) {
                    evt.preventDefault();
                    evt.cancelBubble = true;
                }
                return true;
            }
        }
        return false;
    };
    TextBoxIntellisense.prototype.getCaretOffset = function () {
        return this.editor.selectionStart;
    };
    TextBoxIntellisense.prototype.setEditor = function (editorOrId) {
        var _this = this;
        if (typeof (editorOrId) === 'string') {
            this.editor = document.getElementById(editorOrId);
        }
        else {
            this.editor = editorOrId;
        }
        this.editor.onkeyup = function (evt) {
            if (_this.decls.isVisible()) {
                _this.decls.setFilter(_this.getFilterText());
            }
            if (!_this.processTriggers(_this.triggers.upDecls, evt, _this.declarationsCallback)) {
                _this.processTriggers(_this.triggers.upMeths, evt, _this.methodsCallback);
            }
        };
        this.editor.onkeydown = function (evt) {
            if (_this.decls.isVisible()) {
                if (evt.keyCode === 8) {
                    _this.decls.setFilter(_this.getFilterText());
                }
                else {
                    _this.decls.handleKeyDown(evt);
                }
            }
            if (!_this.processTriggers(_this.triggers.downDecls, evt, _this.declarationsCallback)) {
                _this.processTriggers(_this.triggers.downMeths, evt, _this.methodsCallback);
            }
            if (_this.meths.isVisible()) {
                _this.meths.handleKeyDown(evt);
            }
        };
    };
    TextBoxIntellisense.prototype.getCaretCoordinates = function (element, position) {
        // mirrored div
        var div = document.createElement('div');
        div.id = 'input-textarea-caret-position-mirror-div';
        document.body.appendChild(div);
        var style = div.style;
        var computed = window.getComputedStyle ? getComputedStyle(element) : element.currentStyle; // currentStyle for IE < 9
        // default textarea styles
        style.whiteSpace = 'pre-wrap';
        if (element.nodeName !== 'INPUT') {
            style.wordWrap = 'break-word'; // only for textarea-s
        }
        // position off-screen
        style.position = 'absolute'; // required to return coordinates properly
        style.visibility = 'hidden'; // not 'display: none' because we want rendering
        // transfer the element's properties to the div
        properties.forEach(function (prop) {
            style[prop] = computed[prop];
        });
        if (this.isFirefox) {
            style.width = parseInt(computed.width) - 2 + 'px'; // Firefox adds 2 pixels to the padding - https://bugzilla.mozilla.org/show_bug.cgi?id=753662
            // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
            if (element.scrollHeight > parseInt(computed.height)) {
                style.overflowY = 'scroll';
            }
        }
        else {
            style.overflow = 'hidden'; // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
        }
        div.textContent = element.value.substring(0, position);
        // the second special handling for input type="text" vs textarea: spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
        if (element.nodeName === 'INPUT') {
            div.textContent = div.textContent.replace(/\s/g, "\u00a0");
        }
        var span = document.createElement('span');
        // Wrapping must be replicated *exactly*, including when a long word gets
        // onto the next line, with whitespace at the end of the line before (#7).
        // The  *only* reliable way to do that is to copy the *entire* rest of the
        // textarea's content into the <span> created at the caret position.
        // for inputs, just '.' would be enough, but why bother?
        span.textContent = element.value.substring(position) || '.'; // || because a completely empty faux span doesn't render at all
        div.appendChild(span);
        var coordinates = {
            top: span.offsetTop + parseInt(computed.borderTopWidth),
            left: span.offsetLeft + parseInt(computed.borderLeftWidth)
        };
        document.body.removeChild(div);
        return coordinates;
    };
    TextBoxIntellisense.prototype.addTrigger = function (trigger, methsOrDecls) {
        var type = trigger.type || 'up';
        if (this.triggers[type + methsOrDecls]) {
            this.triggers[type + methsOrDecls].push(trigger);
        }
    };
    /**
     * Adds a trigger to the list of triggers that can cause the declarations user interface
     * to popup.
     *
     * @param trigger The trigger to add
     */
    TextBoxIntellisense.prototype.addDeclarationTrigger = function (trigger) {
        this.addTrigger(trigger, 'Decls');
    };
    /**
     * Adds a trigger to the list of triggers that can cause the methods user interface
     * to popup.
     *
     * @param trigger - The trigger to add
     */
    TextBoxIntellisense.prototype.addMethodsTrigger = function (trigger) {
        this.addTrigger(trigger, 'Meths');
    };
    /**
     * Sets a callback to invoke when a key is pressed that causes the declarations list to
     * popup.
     * @param callback - The callback to set
     */
    TextBoxIntellisense.prototype.onDeclaration = function (callback) {
        this.declarationsCallback = callback;
    };
    /**
     * Sets a callback to invoke when a key is pressed that causes the methods list to
     * popup.
     * @param callback The callback to set
     */
    TextBoxIntellisense.prototype.onMethod = function (callback) {
        this.methodsCallback = callback;
    };
    /**
     * Gets the text after startColumnIndex but before caret offset.
     */
    TextBoxIntellisense.prototype.getFilterText = function () {
        var text = this.editor.value;
        return text.substring(this.startColumnIndex, this.getCaretOffset());
    };
    /**
     * Gets the declarations user interface
     */
    TextBoxIntellisense.prototype.getDecls = function () {
        return this.decls;
    };
    /**
     * Gets the methods user interface
     */
    TextBoxIntellisense.prototype.getMeths = function () {
        return this.meths;
    };
    /**
     * Delegate for setting the methods to display to the user
     * @param data The methods to display
     */
    TextBoxIntellisense.prototype.setMethods = function (data) {
        this.meths.setMethods(data);
    };
    /**
     * Delegate for setting the declarations to display to the user
     * @param data - The declarations to display
     */
    TextBoxIntellisense.prototype.setDeclarations = function (data) {
        this.decls.setDeclarations(data);
    };
    /**
     * Sets the starting location where filtering can occur. This is set when
     * a trigger happens that would cause the declarations list to show
     * @param i - The index to set
     */
    TextBoxIntellisense.prototype.setStartColumnIndex = function (i) {
        this.startColumnIndex = i;
    };
    return TextBoxIntellisense;
}());
