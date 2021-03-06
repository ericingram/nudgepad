// If Node.js, import dependencies.
if (typeof exports != 'undefined') {
  var Space = require('space'),
      fs = require('fs'),
      marked = require('marked')
}
// Use of certain client side functions depends on jQuery inclusion.

function Element (type, attrs) {
  this.type = type
  this.attrs = attrs || {}
  this.content = ''
  return this
}

Element.prototype.addClass = function (className) {
  if (this.attrs['class'])
    this.attrs['class'] += ' ' + className
  else
    this.attrs['class'] = className
}

Element.prototype.append = function (string) {
  this.content += string
}

Element.prototype.attr = function (key, value) {
  this.attrs[key] = value
}

Element.prototype.html = function (string) {
  this.content += string
}

Element.prototype.toHtml = function () {
  var string = '<' + this.type
  
  for (var i in this.attrs) {
    if (!this.attrs.hasOwnProperty(i))
      continue
    string += ' ' + i + '="' + this.attrs[i] + '"' 
  }
  string += '>' + this.content
  
  string += '</' + this.type + '>'
  return string
}

/**
 * Scrap constructor
 * 
 * @param {string}
 * @param {Space}
 */
function Scrap (path, space) {
  this.path = path
  this.id = path.split(/ /g).pop() // Last part of path is id
  this.clear()
  if (!(space instanceof Space))
    space = new Space(space)
  this.patch(space)
  // load content?
  var scraps = this.values.scraps
  if (scraps instanceof Space) {
    for (var i in scraps.keys) {
      var id = scraps.keys[i]
      scraps.values[id] = new Scrap(path + ' ' + id, scraps.values[id])
    }
  }
  
  return this
}

/**
 * Takes text encoded in a certain format and returns HTML
 *
 * @param {string} Text to compile
 * @param {string} Options: nl2br|text|html|markdown
 * @return {string}
 */
Scrap.format = function (string, type) {
  if (type === 'nl2br')
    return string.replace(/\n/g, '<br>')
  
  // todo
  else if (type === 'markdown')
    return marked(string)
  return string
}

/**
 * Evaluate a string and return the corresponding object. (Probably a better
 * way to do this)
 *
 * Given foobar, returns window.foobar
 * Given foobar.foo, returns window.foobar.foo
 *
 * @param {string} Javascript path to the variable. For example: document.location
 * @param {object} Context to evaluate any variables in. If not provided, uses window
 * @return Returns a variable that matches or null if it doesnt exist.
 */
Scrap.getPointer = function (string, context) {
  if (!string)
    return null
  
  // If you pass a string as the context, return null
  // or throw error?
  if (typeof context === 'string')
    return null
  
  // If on node.js return null
  if (!context && typeof window === 'undefined')
    return null
  if (!context)
    context = window
  var parts = string.split('.'),
      current = parts.shift()
  // Not set
  if (!(current in context))
    return null
  // Leaf
  if (!parts.length)
    return context[current]
  // Has scraps
  return Scrap.getPointer(parts.join('.'), context[current])
}

/**
 * Replace any {{variable}} with their value as set in the passed context.
 * You can also set placeholder text if the value is not defined by adding a space
 * and then some text after variable such as {{variable Lorem Ipsum}}
 *
 * @param {string} Something like "My name is {{name}}"
 * @param {object} Context to evaluate any variables in
 * @return {string}
 */
Scrap.replace = function (string, context) {
  return string.replace(/\{\{([_a-zA-Z0-9\.]+)( [^\}]+)?\}\}/g, function(match, name, placeholder) {
    var variable = Scrap.getPointer(name, context)
    return variable || (placeholder ? placeholder.substr(1) : '')
  })
}

/**
 * Turns a style object like color red into css like .scrap { color : red; }
 * Also evals any variables.
 *
 * @param {string} DOM selector. .class #id etc.
 * @param {object} Name/values of css
 * @param {object} Context to evaluate any variables in
 * @return {string} 
 */
Scrap.styleToCss = function (selector, obj, context) {
  var string = selector + ' {\n'
  for (var css_property in obj) {
    if (!obj.hasOwnProperty(css_property))
      continue
    // Add colon and semicolon back on
    string += '  ' + css_property + ' : ' + obj[css_property].toString().replace(/\;$/, '') + ';\n'
  }
  string += '}\n'
  return Scrap.replace(string, context)
}

/**
 * Turns a style object like color red into color: red;
 * Also evals any variables.
 *
 * @param {object} Name/values of css
 * @param {object} Context to evaluate any variables in
 * @return {string} 
 */
Scrap.styleToInline = function (obj, context) {
  var string = ''
  for (var css_property in obj) {
    if (!obj.hasOwnProperty(css_property))
      continue
    // Add colon and semicolon back on
    string += css_property + ': ' + obj[css_property].toString().replace(/\;$/, '') + '; '
  }
  return Scrap.replace(string, context)
}

Scrap.events = 'onblur onchange onclick oncontextmenu onenterkey onfocus onhold onkeydown onkeypress onkeyup onmousedown onmouseout onmouseover onmouseup onorientationchange onsubmit ontouchend ontouchmove ontouchstart'.split(/ /)

// Scrap extends Space.
Scrap.prototype = new Space()

/**
 * @return {Scrap}
 */
Scrap.prototype.clone = function (id) {
  return new Scrap(id, this)
}

/**
 * Sets the innerHTML for uls, ols, and list types. Basically, appends the child
 * elements.
 *
 * Example list:
 * scrap1
 *  type ul
 *  loop {{colors}}
 *  scraps
 *   {{name}}
 *    type ul
 *    content {{value}}
 *
 * @param {object} Context to evaluate any variables in.
 */
Scrap.prototype.loop = function (context) {
  
  // No items. do nothing
  if (!this.values.loop)
    return null
  
  // No item properties. do nothing
  if (!this.values.scraps)
    return null
  
  var partial = this.values.scraps.toString()
  
  var items = this.values.loop
  // Eval any pointers
  if (typeof items === 'string' && items.match(/\{\{/)) {
    items = Scrap.getPointer(items.replace(/\{|\}/g, ''), context)
  }
  // A space separated array
  if (typeof items === 'string') {
    items = this.values.loop.split(/ /g)
  }

  if (!items)
    return null
  
  if (!(items instanceof Space))
    items = new Space(items)
  
  var html = ''
  items.each(function (key, value) {
    
    // replace any variables in item
    var localContext = {key : key, value : value}
    var mold = partial.replace(/\{\{([_a-z0-9\.]+)\}\}/gi, function(match, variableName) {
      var res
      // Search the local context first
      if (res = Scrap.getPointer(variableName, localContext))
        return res
      // If no matches, search global context
      return Scrap.getPointer(variableName, context)
    })
    
    var scraps = new Space(mold)
    scraps.each(function (key, value) {
      html += new Scrap(key, value).toHtml()
    })
    
  })
  this.div.append(html)
}

Scrap.prototype.selector = function () {
  return '#' + this.path.replace(/ /g, ' #')
}

/**
 * Set the innerHTML.
 *
 * @param {object} Context to evaluate any variables in.
 */
Scrap.prototype.setContent = function (context) {
  
  // We loop content if theres a loop
  if (this.values.loop)
    return this.loop(context)
  
  // If leaf node
  if (this.values.content)
    this.div.html(Scrap.format(Scrap.replace(this.values.content, context), this.values.content_format))
  
  // If recursive
  if (this.values.scraps) {
    for (var i in this.values.scraps.keys) {
      var id = this.values.scraps.keys[i]
      this.div.html(this.values.scraps.values[id].toHtml(context))
    }
  }
  return this
}

/**
 * Creates this.div. Sets the type and HTML attrs of the dom element.
 *
 * @param {object} Context to evaluate any variables in.
 */
Scrap.prototype.setElementType = function (context) {
  
  // todo: change type property to element or "kind"
  
  // Create the div and all static properties

  type = (this.values.type ? this.values.type : 'div')
  
  // todo: remove $
  if (type.match(/^(checkbox|color|date|datetime|email|file|month|number|password|radio|range|search|tel|text|time|url|week)$/))
    this.div = new Element('input', {type : type})
  else if (type === 'inputbutton')
    this.div = new Element('input', {type : 'button'})
  else if (type === 'hidden')
    this.div = new Element('input', {type : 'hidden'})
  else
    this.div = new Element(type)

  // Add the id
  this.div.attr('id', this.id)
  
  var properties = 'checked class disabled draggable dropzone end for height href max maxlength min name origin pattern placeholder readonly rel required selected spellcheck src tabindex target title width value'.split(/ /)
  for (var i in properties) {
    this.setProperty(properties[i], context)
  }
  
}

/**
 * Set the standard HTML properties like value, title, et cetera.
 *
 * @param {string} Name of the property to set
 * @param {object} Context to evaluate the variables in.
 */
Scrap.prototype.setProperty = function (name, context) {
  if (this.values[name])
    this.div.attr(name, Scrap.replace(this.values[name], context))
}

/**
 * Return all javascript necessary for scraps operation
 *
 * todo: refacor this
 *
 * @return {string}
 */
Scrap.prototype.setScript = function (context) {

  for (var i in Scrap.events) {
    var event = Scrap.events[i]
    if (!this.values[event])
      continue
    this.div.attr(event, this.values[event])
  }
}

/**
 * Return all css for a scrap.
 *
 * @param {object} Context to evaluate any variables in.
 * @return {string}
 */
Scrap.prototype.setStyle = function (context) {
  if (!this.values.style)
    return null
  if (!(this.values.style instanceof Space))
    return this.div.attr('style', this.values.style)
  this.div.attr('style', Scrap.styleToInline(this.values.style.values, context))
}

/**
 * Returns the HTML for a scrap without CSS or Script.
 *
 * @param {object} Context to evaluate any variables in.
 * @return {string}
 */
Scrap.prototype.toHtml = function (context) {
  this.setElementType(context)
  this.setContent(context)
  this.setStyle(context)
  this.setScript(context)
  return this.div.toHtml()
}

/**
 * Constructor.
 *
 * @param {Space} Any values to load from.
 */
function Page (space) {
  
  this.clear()
  
  if (space)
    this.patch(space)
  
  this.loadScraps()
  return this
}

// Page inherits from Space
Page.prototype = new Space()

/**
 * Does a deep copy
 *
 * @return {Page}
 */
Page.prototype.clone = function () {
  return new Page(this.values)
}

/**
 * Converts any scraps from Space to class of Scrap.
 */
Page.prototype.loadScraps = function () {
  // load all scraps
  for (var i in this.keys) {
    var id = this.keys[i]
    this.values[id] = new Scrap(id, this.values[id])
  }
}

/**
 * @param {object} Context
 * @return null
 */
Page.prototype.request = function (context) {
  // Compile any dynamic code
  // Execute any scraps of type server
  return false
  if (!this.get('head onrequest'))
    return null
  try {
    eval(this.get('head onrequest'))
  } catch (e) {
    if (e instanceof SyntaxError)
      console.log('Syntax error rendering onrequest %s', e.message)
    else
      console.log('Error rendering onrequest %s', e.message)
  }
}

/**
 * Get the full HTML of the page.
 *
 * @param {object} Context to evaluate variables in.
 * @return {string}
 */
Page.prototype.toHtml = function (context) {
  if (!context)
    context = {}
  
  this.request(context)

  // todo: seperate css option
  // todo: separate javascript option
  var html = '<!doctype html>\n'
  
  // Get all the html for every scrap
  // Todo: support after property
  for (var i in this.keys) {
    var id = this.keys[i]
    
    // If a div has property draft true, dont render it
    if (this.values[id].values.draft === 'true')
      continue
    html += '\n  ' + this.values[id].toHtml(context)
  }
  return html
}

// If Node.js, export as a module.
if (typeof exports != 'undefined')
  module.exports = Page;

