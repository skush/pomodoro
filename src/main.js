import { createTimerEngine } from './logic/index.js';
import { mount } from './ui/index.js';

mount(document.getElementById('app'), createTimerEngine());
