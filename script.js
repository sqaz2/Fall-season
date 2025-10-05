const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const operators = ['+', '-', '×', '÷', '^', '(', ')'];

const encounterDeck = [
  {
    name: 'Fractal Wisp',
    lore: 'A rogue shimmer of numbers coils around the arena, warping simple sums into fractal spirals.',
    baseHealth: 120,
    rewards: { stabilize: 1 }
  },
  {
    name: 'Vector Hydra',
    lore: 'Each successful cast severs one of the hydra\'s vector heads before it can multiply unchecked.',
    baseHealth: 150,
    rewards: { reshuffle: 1 }
  },
  {
    name: 'Tempo Apparatus',
    lore: 'A clockwork obelisk that accelerates time whenever your focus slips.',
    baseHealth: 170,
    rewards: { stabilize: 1, reshuffle: 1 }
  },
  {
    name: 'Prime Sovereign',
    lore: 'The sovereign demands only immaculate results — primes resonate with its crystalline core.',
    baseHealth: 200,
    rewards: { stabilize: 2 }
  }
];

const sigilConditions = [
  {
    id: 'threeOperators',
    text: 'Wield at least three operators in your spell.',
    check: (expression) => (expression.match(/[+\-×÷^]/g) || []).length >= 3
  },
  {
    id: 'evenResult',
    text: 'Stabilize the rift with an even result.',
    check: (_, result) => Math.abs(result % 2) < 1e-9
  },
  {
    id: 'parentheses',
    text: 'Bind the energies with at least one set of parentheses.',
    check: (expression) => expression.includes('(') && expression.includes(')')
  },
  {
    id: 'powerGlyph',
    text: 'Invoke the power glyph ^ somewhere in the incantation.',
    check: (expression) => expression.includes('^')
  },
  {
    id: 'highestGlyph',
    text: 'Channel the highest glyph from the bank at least once.',
    check: (expression, _result, context) => {
      const highest = context.glyphs.reduce((max, glyph) => Math.max(max, Number(glyph)), 0);
      return expression.includes(String(highest));
    }
  },
  {
    id: 'subtractive',
    text: 'Temper the spell with a subtraction.',
    check: (expression) => expression.includes('-')
  },
  {
    id: 'lengthy',
    text: 'Compose a lengthy chant with at least eight glyphs.',
    check: (expression) => expression.replace(/\s/g, '').length >= 8
  }
];

const startButton = document.getElementById('startButton');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const levelEl = document.getElementById('level');
const stageEl = document.getElementById('stage');
const timerEl = document.getElementById('timer');
const timeMeter = document.getElementById('timeMeter');
const targetEl = document.getElementById('target');
const glyphBankEl = document.getElementById('glyphBank');
const expressionEl = document.getElementById('expression');
const digitKeysRow = document.getElementById('digitKeys');
const operatorKeysRow = document.getElementById('operatorKeys');
const hintEl = document.getElementById('hint');
const encounterStageEl = document.getElementById('encounterStage');
const encounterTitleEl = document.getElementById('encounterTitle');
const encounterLoreEl = document.getElementById('encounterLore');
const encounterHealthFill = document.getElementById('encounterHealth');
const encounterHpEl = document.getElementById('encounterHP');
const sigilConditionEl = document.getElementById('sigilCondition');
const sigilRewardEl = document.getElementById('sigilReward');
const historyLogEl = document.getElementById('historyLog');
const stabilizeButton = document.getElementById('stabilizeButton');
const reshuffleButton = document.getElementById('reshuffleButton');
const stabilizeCountEl = document.getElementById('stabilizeCount');
const reshuffleCountEl = document.getElementById('reshuffleCount');

let gameState = {
  active: false,
  score: 0,
  streak: 0,
  level: 1,
  stage: 1,
  timer: null,
  timeRemaining: 0,
  baseTime: 35,
  target: null,
  glyphs: [],
  expression: '',
  digitsUsed: new Set(),
  roundCount: 0,
  encounter: null,
  sigilCondition: null,
  sigilBonus: 0,
  artifacts: {
    stabilize: 0,
    reshuffle: 0
  },
  history: []
};

const keyboardButtons = new Map();

function initKeyboard() {
  digits.forEach((d) => {
    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = d;
    button.dataset.value = d;
    digitKeysRow.appendChild(button);
    keyboardButtons.set(d, button);
  });

  operators.forEach((op) => {
    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = op;
    button.dataset.value = op;
    operatorKeysRow.appendChild(button);
    keyboardButtons.set(op, button);
  });

  digitKeysRow.addEventListener('click', onKeyboardClick);
  operatorKeysRow.addEventListener('click', onKeyboardClick);
  document
    .querySelector('.keyboard__row--controls')
    .addEventListener('click', onControlClick);

  document.addEventListener('keydown', onKeyDown);
}

function initArtifacts() {
  stabilizeButton.addEventListener('click', () => useArtifact('stabilize'));
  reshuffleButton.addEventListener('click', () => useArtifact('reshuffle'));
  updateArtifacts();
}

function onKeyboardClick(event) {
  if (event.target instanceof HTMLButtonElement) {
    const value = event.target.dataset.value;
    if (value) appendToExpression(value);
  }
}

function onControlClick(event) {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const action = event.target.dataset.action;
  if (action === 'undo') {
    undoExpression();
  } else if (action === 'clear') {
    clearExpression();
  } else if (action === 'cast') {
    castExpression();
  }
}

function onKeyDown(event) {
  if (!gameState.active) return;
  const key = event.key;
  if (digits.includes(key)) {
    appendToExpression(key);
  } else if (['+', '-', '*', '/', '^', '(', ')'].includes(key)) {
    appendToExpression(key === '*' ? '×' : key === '/' ? '÷' : key);
  } else if (key === 'Backspace') {
    undoExpression();
    event.preventDefault();
  } else if (key === 'Enter') {
    castExpression();
    event.preventDefault();
  }
}

function appendToExpression(value) {
  if (!gameState.active) return;
  gameState.expression += value;
  expressionEl.textContent = gameState.expression;
  if (digits.includes(value)) {
    gameState.digitsUsed.add(value);
    updateGlyphUsage();
  }
}

function undoExpression() {
  if (!gameState.active || gameState.expression.length === 0) return;
  const removed = gameState.expression.slice(-1);
  gameState.expression = gameState.expression.slice(0, -1);
  expressionEl.textContent = gameState.expression || '\u00A0';
  if (digits.includes(removed)) {
    recalculateDigitsUsed();
  }
}

function recalculateDigitsUsed() {
  gameState.digitsUsed.clear();
  for (const char of gameState.expression) {
    if (digits.includes(char)) {
      gameState.digitsUsed.add(char);
    }
  }
  updateGlyphUsage();
}

function clearExpression() {
  if (!gameState.active) return;
  gameState.expression = '';
  gameState.digitsUsed.clear();
  expressionEl.textContent = '\u00A0';
  updateGlyphUsage();
}

function castExpression() {
  if (!gameState.active || !gameState.expression.trim()) {
    setHint('Craft an expression before casting.');
    return;
  }

  const outcome = evaluateExpression(gameState.expression);
  if (!outcome.valid) {
    setHint(outcome.message);
    logSpell({
      success: false,
      expression: gameState.expression,
      result: null,
      message: outcome.message
    });
    penalize(false, {
      skipLog: true,
      message: outcome.message,
      expression: gameState.expression
    });
    return;
  }

  const usesAllowedDigits = [...gameState.expression].every((char) => {
    return !digits.includes(char) || gameState.glyphs.includes(char);
  });

  if (!usesAllowedDigits) {
    const message = 'Only digits from the glyph bank may be summoned.';
    setHint(message);
    logSpell({
      success: false,
      expression: gameState.expression,
      result: outcome.value,
      message: 'Illegal glyph usage.'
    });
    penalize(false, {
      skipLog: true,
      message,
      expression: gameState.expression,
      result: outcome.value
    });
    return;
  }

  const result = outcome.value;
  if (Math.abs(result - gameState.target) < 1e-9) {
    const sigilComplete = checkSigilCondition(gameState.expression, result);
    reward(outcome, { sigilComplete });
  } else {
    const message = `The spell resolved to ${formatNumber(result)}, not ${gameState.target}.`;
    setHint(message);
    logSpell({
      success: false,
      expression: gameState.expression,
      result,
      message
    });
    penalize(true, {
      skipLog: true,
      message,
      expression: gameState.expression,
      result
    });
  }
}

function evaluateExpression(rawExpression) {
  const sanitized = rawExpression
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/\^/g, '**');

  if (/[^0-9+\-*/()\s*.]/.test(sanitized)) {
    return { valid: false, message: 'Unknown glyph detected.' };
  }

  try {
    const fn = new Function(`return (${sanitized})`);
    const value = fn();
    if (!Number.isFinite(value)) {
      return { valid: false, message: 'The incantation collapsed into infinity.' };
    }
    return { valid: true, value };
  } catch (error) {
    return { valid: false, message: 'The structure of the spell is unstable.' };
  }
}

function formatNumber(value) {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return Number.parseFloat(value.toFixed(2)).toString();
}

function checkSigilCondition(expression, result) {
  if (!gameState.sigilCondition) {
    return false;
  }

  try {
    return gameState.sigilCondition.check(expression, result, {
      glyphs: gameState.glyphs
    });
  } catch (error) {
    return false;
  }
}

function reward(outcome, extras = {}) {
  const { sigilComplete = false } = extras;
  const allDigitsUsed = gameState.glyphs.every((glyph) =>
    gameState.digitsUsed.has(glyph)
  );
  const base = 140 + gameState.level * 22;
  const comboMultiplier = allDigitsUsed ? 1.6 + gameState.level * 0.05 : 1;
  const complexityMultiplier = Math.min(3, 1 + gameState.expression.length / 8);
  const gain = Math.round(base * comboMultiplier * complexityMultiplier);
  const sigilBonus = sigilComplete ? gameState.sigilBonus : 0;
  const totalGain = gain + sigilBonus;

  gameState.score += totalGain;
  gameState.streak += 1;
  if (gameState.streak % 3 === 0) {
    gameState.level += 1;
  }

  const bonusText = [];
  if (allDigitsUsed) {
    bonusText.push('All glyphs ×' + comboMultiplier.toFixed(2));
  }
  if (complexityMultiplier > 1) {
    bonusText.push('Complexity boost');
  }
  if (sigilComplete) {
    bonusText.push('Sigil honored');
    sigilRewardEl.textContent = 'Sigil honored! Bonus delivered.';
  }

  const summary = `Spell lands! +${totalGain} essence${
    bonusText.length ? ' (' + bonusText.join(', ') + ')' : ''
  }.`;
  setHint(summary);
  logSpell({
    success: true,
    expression: gameState.expression,
    result: outcome.value,
    message: summary,
    tags: bonusText
  });

  flashMeter('success');
  updateStatus();
  updateArtifacts();
  const encounterResolved = applyEncounterDamage(totalGain, { sigilComplete });
  if (!encounterResolved) {
    nextChallenge();
  }
}

function applyEncounterDamage(scoreGain, { sigilComplete }) {
  if (!gameState.encounter) {
    return false;
  }

  const baseDamage = Math.max(12, Math.round(scoreGain / 4));
  const sigilDamage = sigilComplete ? Math.round(gameState.sigilBonus / 3) : 0;
  const totalDamage = baseDamage + sigilDamage;
  gameState.encounter.health = Math.max(
    0,
    gameState.encounter.health - totalDamage
  );
  updateEncounter();

  if (gameState.encounter.health <= 0) {
    handleEncounterVictory();
    return true;
  }
  return false;
}

function handleEncounterVictory() {
  const defeated = gameState.encounter;
  logEncounterEvent(`${defeated.name} stabilized. Spoils resonate!`);
  grantArtifacts(defeated.rewards);
  gameState.stage += 1;
  gameState.roundCount = 0;
  const acceleration = Math.min(12, Math.floor(gameState.stage / 2));
  gameState.baseTime = Math.max(20, 35 - acceleration);
  setupEncounter();
  nextChallenge();
  setHint(`The realm steadies. Prepare for Stage ${gameState.stage}.`);
}

function setupEncounter() {
  const index = (gameState.stage - 1) % encounterDeck.length;
  const cycle = Math.floor((gameState.stage - 1) / encounterDeck.length);
  const template = encounterDeck[index];
  const scale = 1 + cycle * 0.4 + (gameState.stage - 1) * 0.08;
  const maxHealth = Math.max(80, Math.round(template.baseHealth * scale));
  gameState.encounter = {
    ...template,
    health: maxHealth,
    maxHealth
  };
  encounterTitleEl.textContent = template.name;
  encounterLoreEl.textContent = template.lore;
  encounterStageEl.textContent = gameState.stage;
  updateEncounter();
}

function updateEncounter() {
  if (!gameState.encounter) return;
  const ratio = Math.max(
    0,
    gameState.encounter.health / gameState.encounter.maxHealth
  );
  encounterHealthFill.style.transform = `scaleX(${ratio})`;
  encounterHpEl.textContent = `${gameState.encounter.health} / ${gameState.encounter.maxHealth} stability`;
  stageEl.textContent = gameState.stage;
  encounterStageEl.textContent = gameState.stage;
}

function assignSigilCondition() {
  if (!gameState.active) {
    sigilConditionEl.textContent = 'Complete a cast to reveal the realm.';
    sigilRewardEl.textContent = 'Bonus ready.';
    return;
  }
  const condition =
    sigilConditions[Math.floor(Math.random() * sigilConditions.length)];
  gameState.sigilCondition = condition;
  gameState.sigilBonus = Math.round(120 + gameState.level * 25 + gameState.stage * 12);
  sigilConditionEl.textContent = condition.text;
  sigilRewardEl.textContent = `Bonus: +${gameState.sigilBonus} essence & heavy stability damage.`;
}

function grantArtifacts(rewards = {}) {
  if (!rewards) return;
  if (rewards.stabilize) {
    gameState.artifacts.stabilize += rewards.stabilize;
  }
  if (rewards.reshuffle) {
    gameState.artifacts.reshuffle += rewards.reshuffle;
  }
  updateArtifacts();
}

function updateArtifacts() {
  stabilizeCountEl.textContent = gameState.artifacts.stabilize;
  reshuffleCountEl.textContent = gameState.artifacts.reshuffle;
  const canStabilize = gameState.active && gameState.artifacts.stabilize > 0;
  const canReshuffle = gameState.active && gameState.artifacts.reshuffle > 0;
  stabilizeButton.disabled = !canStabilize;
  reshuffleButton.disabled = !canReshuffle;
}

function useArtifact(type) {
  if (!gameState.active) return;
  if (!gameState.artifacts[type] || gameState.artifacts[type] <= 0) return;

  if (type === 'stabilize') {
    gameState.artifacts.stabilize -= 1;
    gameState.timeRemaining = Math.min(
      gameState.currentTimeLimit,
      gameState.timeRemaining + Math.max(5, Math.round(gameState.currentTimeLimit * 0.35))
    );
    updateTimerDisplay();
    setHint('Time stabilizes, granting you a breath.');
    logEncounterEvent('Used Stabilize Flow to reclaim a few precious moments.');
    updateArtifacts();
  } else if (type === 'reshuffle') {
    gameState.artifacts.reshuffle -= 1;
    updateArtifacts();
    gameState.roundCount = Math.max(0, gameState.roundCount - 1);
    nextChallenge(false);
    setHint('You reforge the glyphs into a fresh arrangement.');
    logEncounterEvent('Reforged the glyph bank for a new opportunity.');
    return;
  }
}

function addHistoryEntry(entry) {
  gameState.history.unshift(entry);
  gameState.history = gameState.history.slice(0, 8);
  updateHistory();
}

function logSpell({ expression, result, success, message, tags = [] }) {
  if (!historyLogEl) return;
  addHistoryEntry({
    type: 'spell',
    expression: expression || '—',
    result:
      typeof result === 'number' && Number.isFinite(result)
        ? formatNumber(result)
        : result,
    success,
    message,
    tags,
    timestamp: Date.now()
  });
}

function logEncounterEvent(message) {
  if (!historyLogEl) return;
  addHistoryEntry({
    type: 'event',
    success: true,
    message,
    timestamp: Date.now()
  });
}

function updateHistory() {
  historyLogEl.innerHTML = '';
  if (!gameState.history.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'chronicle__entry chronicle__entry--empty';
    placeholder.textContent = 'No spells recorded yet.';
    historyLogEl.appendChild(placeholder);
    return;
  }
  gameState.history.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'chronicle__entry';
    if (entry.type === 'spell') {
      if (!entry.success) {
        item.classList.add('is-failure');
      }
      const expression = document.createElement('div');
      expression.className = 'chronicle__expression';
      expression.textContent = entry.expression;
      item.appendChild(expression);

      const details = document.createElement('div');
      details.className = 'chronicle__details';
      if (entry.result !== undefined && entry.result !== null) {
        const resultSpan = document.createElement('span');
        resultSpan.textContent = `Result: ${entry.result}`;
        details.appendChild(resultSpan);
      }
      if (entry.message) {
        const messageSpan = document.createElement('span');
        messageSpan.textContent = entry.message;
        details.appendChild(messageSpan);
      }
      if (entry.tags && entry.tags.length) {
        const tagsSpan = document.createElement('span');
        tagsSpan.textContent = entry.tags.join(' • ');
        details.appendChild(tagsSpan);
      }
      item.appendChild(details);
    } else {
      item.classList.add('is-event');
      const message = document.createElement('div');
      message.className = 'chronicle__expression';
      message.textContent = entry.message;
      item.appendChild(message);
    }
    historyLogEl.appendChild(item);
  });
}

function penalize(isWrongValue, context = {}) {
  gameState.streak = 0;
  gameState.level = Math.max(1, gameState.level - 0.25);
  const defaultMessage = isWrongValue
    ? 'The spell fizzled. Match the target exactly.'
    : 'The glyphs rebelled. Try another structure.';
  const message = context.message || defaultMessage;
  setHint(message);
  if (!context.skipLog) {
    logSpell({
      success: false,
      expression: context.expression ?? gameState.expression,
      result: context.result,
      message
    });
  }
  updateStatus();
  flashMeter('danger');
  updateArtifacts();
}

function flashMeter(type) {
  const className = type === 'danger' ? 'is-danger' : 'is-success';
  timeMeter.classList.add(className);
  setTimeout(() => timeMeter.classList.remove(className), 300);
}

function updateStatus() {
  scoreEl.textContent = gameState.score;
  streakEl.textContent = gameState.streak;
  levelEl.textContent = Math.max(1, Math.floor(gameState.level));
  stageEl.textContent = gameState.stage;
}

function updateTimerDisplay() {
  timerEl.textContent = Math.max(0, Math.ceil(gameState.timeRemaining)).toString();
  const ratio = Math.max(0, gameState.timeRemaining / gameState.currentTimeLimit);
  timeMeter.style.transform = `scaleX(${ratio})`;
}

function resetTimer() {
  if (gameState.timer) {
    clearInterval(gameState.timer);
  }
  gameState.currentTimeLimit = Math.max(
    8,
    gameState.baseTime - gameState.level * 1.5 - gameState.roundCount
  );
  gameState.timeRemaining = gameState.currentTimeLimit;
  updateTimerDisplay();
  gameState.timer = setInterval(() => {
    gameState.timeRemaining -= 0.1;
    if (gameState.timeRemaining <= 0) {
      clearInterval(gameState.timer);
      gameState.timer = null;
      penalize(true, {
        message: 'Time unraveled before the incantation completed.',
        expression: gameState.expression
      });
      logEncounterEvent('The temporal meter collapsed! The rift surges.');
      nextChallenge();
    }
    updateTimerDisplay();
  }, 100);
}

function updateGlyphBank() {
  glyphBankEl.innerHTML = '';
  gameState.glyphs.forEach((glyph) => {
    const li = document.createElement('li');
    li.textContent = glyph;
    if (gameState.digitsUsed.has(glyph)) {
      li.classList.add('used');
    }
    glyphBankEl.appendChild(li);
  });
}

function updateGlyphUsage() {
  const items = glyphBankEl.querySelectorAll('li');
  items.forEach((item) => {
    const glyph = item.textContent;
    item.classList.toggle('used', gameState.digitsUsed.has(glyph));
  });
}

function setHint(message) {
  hintEl.textContent = message;
}

function nextChallenge(advanceRound = true) {
  if (advanceRound) {
    gameState.roundCount += 1;
  }
  gameState.glyphs = selectGlyphs();
  gameState.target = craftTarget(gameState.glyphs);
  gameState.expression = '';
  gameState.digitsUsed.clear();

  targetEl.textContent = gameState.target;
  expressionEl.textContent = '\u00A0';
  updateGlyphBank();
  assignSigilCondition();
  setHint('Compose a spell that resolves to the target glyph.');
  resetTimer();
}

function selectGlyphs() {
  const count = Math.min(
    9,
    Math.max(
      3,
      4 + Math.floor(gameState.level / 2) + Math.floor(Math.max(0, gameState.stage - 1) / 2)
    )
  );
  const pool = [...digits];
  const chosen = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen.sort();
}

function craftTarget(glyphs) {
  const sampleDigits = [...glyphs];
  const opsPool = ['+', '-', '*', '/'];
  if (gameState.stage >= 3) {
    opsPool.push('**');
  }
  let expression = '';
  let lastWasOperator = true;
  const extraLength = Math.min(3, Math.floor(gameState.stage / 2));
  const length = 3 + Math.floor(Math.random() * (3 + extraLength));
  for (let i = 0; i < length; i++) {
    if (lastWasOperator) {
      const digit = sampleDigits[Math.floor(Math.random() * sampleDigits.length)];
      expression += digit;
      lastWasOperator = false;
    } else {
      const op = opsPool[Math.floor(Math.random() * opsPool.length)];
      expression += op;
      lastWasOperator = true;
    }
  }
  if (lastWasOperator) {
    expression += sampleDigits[Math.floor(Math.random() * sampleDigits.length)];
  }

  try {
    const value = new Function(`return (${expression})`)();
    const rounded = Math.round(value);
    return Math.max(-99, Math.min(120, rounded));
  } catch (error) {
    return Math.floor(Math.random() * 50) + 10;
  }
}

function startGame() {
  if (gameState.timer) {
    clearInterval(gameState.timer);
  }
  gameState = {
    active: true,
    score: 0,
    streak: 0,
    level: 1,
    stage: 1,
    timer: null,
    timeRemaining: 0,
    baseTime: 35,
    currentTimeLimit: 0,
    target: null,
    glyphs: [],
    expression: '',
    digitsUsed: new Set(),
    roundCount: 0,
    encounter: null,
    sigilCondition: null,
    sigilBonus: 0,
    artifacts: {
      stabilize: 0,
      reshuffle: 0
    },
    history: []
  };
  updateStatus();
  updateArtifacts();
  updateHistory();
  timerEl.textContent = '--';
  setHint('The codex hums with possibility.');
  logEncounterEvent('A new ritual begins.');
  setupEncounter();
  nextChallenge();
  startButton.textContent = 'Restart Ritual';
}

startButton.addEventListener('click', () => {
  startGame();
});

initKeyboard();
initArtifacts();
updateHistory();
setHint('Ready when you are. Tap Start Casting to begin.');
