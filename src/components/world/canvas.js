function createCanvas(options) {
  const { selector, id } = options

  if (!selector || typeof selector !== 'string') {
    throw(new Error("You must provide a DOM selector as the first argument in order to render the Dice Box"))
  }

  let canvas
  const container = document.querySelector(selector)

  if(!container?.nodeName){
    throw(new Error(`DiceBox target DOM node: '${selector}' not found or not available yet. Try invoking inside a DOMContentLoaded event`))
  }
  
  if(container.nodeName.toLowerCase() !== 'canvas') {
    canvas = document.createElement('canvas')
    canvas.id = id
    container.appendChild(canvas)
  } 
  else {
    canvas = container
  }
  return canvas
}

export { createCanvas }