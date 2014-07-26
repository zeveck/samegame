// Written by Rich Conlan
// v1.3 - August 13, 2012

// v1.4 - July 4, 2014 :: Hacked in adjustments to tweak for Android WebView. Tweaks not reflected in git!
//                        Added anyLegalMoves() and "Game Over" output for mobile. NOT REFLECTED IN GIT!

// Implementation by RConlan. Based on Same Game by Ikuo Hirotaha, written for 
// Windows 3.1, itself based on the MS-DOS version by Eiji Fukumoto and Wataru Yoshioka.

// Main namespace.
function SameGame() {

var ADJUST_COLUMNS = 0
var ADJUST_ROWS = 0;

// Check for mobile users.
var isMobile = false;
var userAgent = navigator.userAgent.toLowerCase();
if (userAgent.indexOf('android') > 0 ||
    userAgent.indexOf('ipad') > 0 || userAgent.indexOf('iphone') > 0) {
//  isMobile = true;
  document.querySelector("#samelogo").style.display = "none";
  document.querySelector("#sameattributionblock").style.display = "none";
  ADJUST_COLUMNS = 1;
  ADJUST_ROWS = 0;
  SHOW_SAME_OVER = true;
} else {
  document.querySelector("#sameover").style.display = "none";
}

// Constants.
var COLORS = ['red', 'yellow', 'cyan', 'blue', 'magenta'];
var LETTERS = ['B', 'D', 'E', 'A', 'C'];
var BLOCK_SIZE_IN_PIXELS = isMobile ? 80 : 40;
var ANIMATION_INCREMENT = isMobile ? 20 : 10;
var DEFAULT_BLOCK_BORDER = '#111 solid 1px';

// DOM elements.
var sameboard = document.getElementById('sameboard');
var samelogo = document.getElementById('samelogo');
var sametitleblock = document.getElementById('sametitleblock');
var samescore = document.getElementById('samescore');
var samepoints = document.getElementById('samepoints');
var samestartbutton = document.getElementById('startbutton');
var samerestartbutton = document.getElementById('restartbutton');
var sameattributionblock = document.getElementById('sameattributionblock');

if (isMobile) {
  samelogo.className = 'mobileHeaderSize';
  samestartbutton.className = 'mobileHeaderSize';
  samerestartbutton.className = 'mobileHeaderSize';
  samescore.className = 'mobileHeaderSize';
  samepoints.className = 'mobileHeaderSize';
}

// Board dimensions.
var boardHeight = document.body.offsetHeight;
var boardWidth = document.body.offsetWidth;
var maxColumnHeight = Math.floor((boardHeight  / BLOCK_SIZE_IN_PIXELS)) - 2 + ADJUST_ROWS;
var columnCount = Math.floor((boardWidth / BLOCK_SIZE_IN_PIXELS)) - 1 + ADJUST_COLUMNS;
sameboard.style.height = maxColumnHeight * BLOCK_SIZE_IN_PIXELS + 'px';
sameboard.style.width = columnCount * BLOCK_SIZE_IN_PIXELS + 'px';
sametitleblock.style.width = columnCount * BLOCK_SIZE_IN_PIXELS + 'px';
sameattributionblock.style.width = columnCount * BLOCK_SIZE_IN_PIXELS + 'px';

// Game state.
var blockRemovalCount = 0;
var rootColumn = null;
var seed = getSeed();

// Defines Block object.
var Block = {
  alive: true,
  blockDiv: null,
  blockHeight: 0,
  color: null,
  nextBlock: null,
  prevBlock: null,
  

  // Animates the drop of the block.
  currentTop: 0,
  newTop: 0,
  animateBlockDrop: function(newBlockHeight) {
    this.currentTop = (maxColumnHeight - this.blockHeight - 1) * BLOCK_SIZE_IN_PIXELS;
    this.newTop = (maxColumnHeight - newBlockHeight - 1) * BLOCK_SIZE_IN_PIXELS;
    this.blockHeight = newBlockHeight;
    this.scoochBlock(this);
  },


  // Drops the block by a small delta then sets a timeout to call itself again
  // if the block has further to move.
  scoochBlock: function(self) {
    var remainingDelta = self.newTop - self.currentTop;
    if (remainingDelta > 0) {
      var scooch = Math.min(ANIMATION_INCREMENT, remainingDelta);
      self.currentTop += scooch;
      if (self.blockDiv) {
        self.blockDiv.style.top = self.currentTop;
      }
      if (remainingDelta - scooch > 0) {
        setTimeout(function() { self.scoochBlock(self) }, 40);
      }
    }
  }
};


// Defines Column object.
var Column = {
  baseBlock: null,
  columnNumber: 0,
  dirty: false,
  nextColumn: null,
  prevColumn: null,
  timeoutid: null,


  // Returns the block at the specified row height or null if the row is
  // shorter than that.
  getBlock: function(targetBlockHeight) {
    var block = null;
    if (this.baseBlock) {
      block = this.baseBlock;
      for (var blockHeight = 0; blockHeight < targetBlockHeight; ++blockHeight) {
        if (!block.nextBlock) {
	  return null;
	}
	block = block.nextBlock;
      }
    }
    return block;
  },


  // Removes the specified block from the board and marks the metablock dead.
  killBlock: function(block) {
    // Remove the corresponding block form the DOM.
    if (block.timeoutId) {
      cancelTimeout(block.timeoutId);
      block.timeoutId = null;
    }

    block.alive = false;
    block.column.dirty = true;
    block.blockDiv.style.opacity = '0.7';
    block.blockDiv.style.border = '#000 dashed 1px';
  },


  // Removes all dead metablocks from the column.
  purgeDeadBlocks: function() {
    var block = this.baseBlock;
    while (block) {
      if (!block.alive) {
        this.removeBlock(block);
      }
      block = block.nextBlock;
    }
  },


  // Collapses this column so that blocks "fall" to fill open spaces.
  collapseColumn: function() {
    var block = this.baseBlock;
    var stableBlockHeight = 0;
    while (block) {
      if (block.blockHeight > stableBlockHeight) {
        block.animateBlockDrop(stableBlockHeight);
      }
      block = block.nextBlock;
      ++stableBlockHeight;
    }
  },


  // Removes the specified block from its column, and may remove the
  // column if the column is now empty.
  removeBlock: function(block) {
    // Remove block from DOM.
    sameboard.removeChild(block.blockDiv);
    block.blockDiv = null;

    // Remove block from its column.
    var nextBlock = block.nextBlock;
    var prevBlock = block.prevBlock;
    if (nextBlock) {
      nextBlock.prevBlock = prevBlock;
    }
    if (prevBlock) {
      prevBlock.nextBlock = nextBlock;
    }
    if (block == this.baseBlock) {
      this.baseBlock = nextBlock;
    }
    if (!this.baseBlock) {
      this.removeThisColumn();
    }
  },


  // Remove this column from the model.
  removeThisColumn: function() {
    var nextColumn = this.nextColumn;
    var prevColumn = this.prevColumn;
    if (nextColumn) {
      nextColumn.prevColumn = prevColumn;
    }
    if (prevColumn) {
      prevColumn.nextColumn = nextColumn;
    }
    if (this == rootColumn) {
      rootColumn = nextColumn;
    }

    // Slide the remaining columns left.
    while (nextColumn) {
      nextColumn.animateSlideLeft();
      nextColumn = nextColumn.nextColumn;
    }
  },

  // Marks the 'killed' blocks in the column alive.
  reviveColumn: function() {
    var block = this.baseBlock;
    while (block) {
      block.alive = true;
      block.blockDiv.style.border = DEFAULT_BLOCK_BORDER;
      block.blockDiv.style.opacity = '1.0';
      block = block.nextBlock;
    }
  },


  // Animate sliding remaining columns to fill an empty column.
  currentLeft: 0,
  newLeft: 0,
  animateSlideLeft: function() {
    --this.columnNumber;
    this.newLeft = this.columnNumber * BLOCK_SIZE_IN_PIXELS;
    if (!this.timeoutId) {
      this.currentLeft = (this.columnNumber + 1) * BLOCK_SIZE_IN_PIXELS;
      this.scoochColumn(this);
    }
  },


  // Slides the column by a small delta then sets a timeout to call itself again
  // if the column has further to move.
  scoochColumn: function(self) {
    var remainingDelta = self.currentLeft - self.newLeft;
    if (remainingDelta > 0) {
      var scooch = Math.min(ANIMATION_INCREMENT, remainingDelta);
      self.currentLeft -= scooch;

      var block = self.baseBlock;
      while (block) {
        if (block.blockDiv) {
          block.blockDiv.style.left = self.currentLeft;
	}
	block = block.nextBlock;
      }

      if (remainingDelta - scooch > 0) {
        self.timeoutId = setTimeout(function() { self.scoochColumn(self) }, 40);
      } else {
        self.timeoutId = null;
      }
    }
  }
};

// Check if done.
function anyLegalPlays() {
  var column = rootColumn;
  while (column) {
    var block = column.baseBlock;
    while (block) {
      if (!isSingleBlock(block)) {
        return true;
      }

      block = block.nextBlock;
    }
    column = column.nextColumn;
  }
  return false;
}


// Starts the game.
function start() {
  Math.seedrandom(seed);
  resetScore();
  sameboard.innerHTML = '';

  rootColumn = appendColumn(currentColumn);
  var currentColumn = rootColumn;
  for (var i = 1; i < columnCount; ++i) {
    currentColumn = appendColumn(currentColumn);
  }
}


// Creates a new column and all the column's blocks and attaches it to
// the baseColumn if specified.
function appendColumn(baseColumn) {
  newColumn = Object.create(Column);
  if (baseColumn) {
    newColumn.columnNumber = baseColumn.columnNumber + 1;
    newColumn.prevColumn = baseColumn;
    baseColumn.nextColumn = newColumn;
  }

  newColumn.baseBlock = appendBlock(newColumn, null, newColumn.columnNumber, maxColumnHeight - 1);
  var currentBlock = newColumn.baseBlock;
  for (var j = maxColumnHeight - 2; j >= 0; --j) {
    currentBlock = appendBlock(newColumn, currentBlock, newColumn.columnNumber, j);
  }

  return newColumn;
}


// Creates a new Block, adds it to the board, and attaches it to
// the baseBlock if specified.
function appendBlock(parentColumn, baseBlock, columnNumber, blockHeight) {
  var blockDiv = document.createElement('div');
  blockDiv.style.border = DEFAULT_BLOCK_BORDER;
  blockDiv.className = 'block';
  var colorIndex = Math.floor(Math.random() * 5);
  var color = COLORS[colorIndex];
  blockDiv.innerText = LETTERS[colorIndex];
  blockDiv.className += ' ' + color;
  if (isMobile) {
    blockDiv.className += ' mobileBlockSizes';
  } else {
    blockDiv.className += ' desktopBlockSizes';
  }
  blockDiv.style.left = columnNumber * BLOCK_SIZE_IN_PIXELS;
  blockDiv.style.top = blockHeight * BLOCK_SIZE_IN_PIXELS;
  sameboard.appendChild(blockDiv);

  var newBlock = Object.create(Block);
  if (baseBlock) {
    newBlock.blockHeight = baseBlock.blockHeight + 1;
    newBlock.prevBlock = baseBlock;
    baseBlock.nextBlock = newBlock;
  }
  newBlock.column = parentColumn;
  newBlock.color = colorIndex;
  newBlock.blockDiv = blockDiv;
  blockDiv.block = newBlock;
  return newBlock;
};


// Check if the block is a singleton with no adjacent matching colors.
// Returns true if so or false if not.
function isSingleBlock(block) {
  var prevBlock = block.prevBlock;
  var nextBlock = block.nextBlock;
  var leftBlock = null;
  if (block.column.prevColumn) {
    leftBlock = block.column.prevColumn.getBlock(block.blockHeight);
  }
  var rightBlock = null;
  if (block.column.nextColumn) {
    rightBlock = block.column.nextColumn.getBlock(block.blockHeight);
  }

  if ((prevBlock && prevBlock.color == block.color && prevBlock.alive == block.alive) ||
      (nextBlock && nextBlock.color == block.color && nextBlock.alive == block.alive) ||
      (leftBlock && leftBlock.color == block.color && leftBlock.alive == block.alive) ||
      (rightBlock && rightBlock.color == block.color && rightBlock.alive == block.alive)) {
    return false;
  }
  return true;
}


// Marks all 'killed' blocks as alive.
function reviveBoard() {
  var column = rootColumn;
  while (column) {
    column.reviveColumn();
    column = column.nextColumn;
  }
}


// Removes the specified block from its column and from the board
// and then removes any adjacent blocks of the same color.
function killBlockAndSame(block) {
  ++blockRemovalCount;
  block.column.killBlock(block);

  var prevBlock = block.prevBlock;
  var nextBlock = block.nextBlock;
  var leftBlock = null;
  if (block.column.prevColumn) {
    leftBlock = block.column.prevColumn.getBlock(block.blockHeight);
  }
  var rightBlock = null;
  if (block.column.nextColumn) {
    rightBlock = block.column.nextColumn.getBlock(block.blockHeight);
  }

  if (prevBlock && prevBlock.color == block.color && prevBlock.alive) {
    killBlockAndSame(block.prevBlock);
  }
  if (nextBlock && nextBlock.color == block.color && nextBlock.alive) {
    killBlockAndSame(block.nextBlock);
  }
  if (leftBlock && leftBlock.color == block.color && leftBlock.alive) {
    killBlockAndSame(leftBlock);
  }
  if (rightBlock && rightBlock.color == block.color && rightBlock.alive) {
    killBlockAndSame(rightBlock);
  }
}


// Collapse remaining blocks down and left as blocks are removed.
function collapseBoard() {
  var column = rootColumn;
  while (column) {
    if (column.dirty) {
      column.purgeDeadBlocks();
      column.collapseColumn();
      column.dirty = false;
    }
    column = column.nextColumn;
  }
}


// Resets the score to 0.
function resetScore() {
  samescore.innerHTML = '0';
  document.querySelector("#sameover").style.visibility = "hidden";
}


// Displays the number of points available.
function updatePointsAvailable(blocksKilled) {
  var points = 0; 
  for (var i = 0; i < blocksKilled; ++i) {
    points += i * 2;
  }
  if (points > 0) {
    samepoints.points = points;
    samepoints.innerHTML = '+' + points;
  } else {
    samepoints.points = 0;
    samepoints.innerHTML = '';
  }
}


// Increments the score by points.
function incrementScore() {
  var currentScore = parseInt(samescore.innerHTML);
  samescore.innerHTML = currentScore + samepoints.points;
  updatePointsAvailable(0);
}


// Returns a new random seed.
function getSeed() {
  return Math.random() * 1000000;
}


// Start the game.
function startGame() {
  start();

  // Remove 'same' blocks when a block is clicked.
  sameboard.onclick = function(ev) {
    var pageElem = ev.target;
    if (pageElem.id != 'sameboard') {
      var block = pageElem.block;
      if (isSingleBlock(block)) {
	updatePointsAvailable(0);
        reviveBoard();
        return;
      }

      if (!block.alive) {
        collapseBoard();
        incrementScore();
      } else {
        reviveBoard();
        blockRemovalCount = 0;
        killBlockAndSame(block);
	updatePointsAvailable(blockRemovalCount);
      }

      if (!anyLegalPlays()) {
        document.querySelector("#sameover").style.visibility = "visible";
      }
    }
  };

  // Attach the Start button.
  samestartbutton.onclick = function() {
    seed = getSeed();
    start();
  }

  // Attach the Restart button.
  samerestartbutton.onclick = function() {
    start();
  }
};

startGame();
};

// Give the page plenty of time to load.
// Kindle Fire sometimes renders small board if we execute immediate onload.
window.onload = setTimeout(function() { SameGame(); }, 500);
