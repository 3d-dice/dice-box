import './canvas.css'

function createCanvas(options) {
  const { selector, id } = options

  let container = document.body
  let canvas = document.createElement('canvas')
  canvas.id = id
  canvas.classList.add('dice-box-canvas')

  if(selector) {
    if (typeof selector !== 'string') {
      throw(new Error("You must provide a DOM selector as the first argument in order to render the Dice Box"))
    }

    container = document.querySelector(selector)

    if(!container?.nodeName){
      throw(new Error(`DiceBox target DOM node: '${selector}' not found or not available yet. Try invoking inside a DOMContentLoaded event`))
    }
  }

  container.appendChild(canvas)

  return canvas
}

export { createCanvas }