import 'vite/modulepreload-polyfill'
import { hydrateRoot } from 'react-dom/client'
import { Randomizer, type RandomizerProps } from './randomizer'
import './style.css'

const root = document.getElementById('randomizer')
const props = document.getElementById('randomizer-props')
if (root && props?.textContent) {
  hydrateRoot(root, <Randomizer {...(JSON.parse(props.textContent) as RandomizerProps)} />)
}
