function _onConsensusEstablished() {
  $syncPercentage.style.display = "none";
  $status.innerText = 'connected';
  $status.classList.add('consensus-established');
  document.getElementById('search-submit').removeAttribute('disabled');
  document.getElementById('search-submit').removeAttribute('title');

  _buildListOfLatestBlocks();

  if (!window.onhashchange) {
    window.onhashchange = _onHashChange;
    _onHashChange();
  }
}

function _onConsensusLost() {
  console.error('Consensus lost');
  $status.innerText = 'consensus lost';
  $status.classList.remove('consensus-established', 'synchronizing');
}

function _onHeadChanged() {
  var height = $.blockchain.height;
  $height.innerText = '#' + height;
  if (syncStartHeight !== 0 && syncTargetHeight !== 0)
    $syncPercentage.innerText = " (" + Math.floor((height - syncStartHeight) / (syncTargetHeight - syncStartHeight) * 100) + "%)";

  if (blocklistBuilt) {
    _getBlockInfo($.blockchain.headHash, function(blockInfo) {
      _addBlockToListOfLatestBlocks(blockInfo);
    });
  }
}

function _onPeersChanged() {
  document.getElementById('monitor').setAttribute('title', 'Connected to ' + $.network.peerCount + ' peers');
}

Evo.init(function($) {
  $status.innerText = 'synchronizing';
  $status.classList.add('synchronizing');

  window.$ = $;

  $.consensus.on('syncing', function(targetHeight) {
    syncTargetHeight = targetHeight;
    syncStartHeight = $.blockchain.head.height;
  });
  $.consensus.on('established', _onConsensusEstablished);
  $.consensus.on('lost', _onConsensusLost);

  $.blockchain.on('head-changed', _onHeadChanged);
  _onHeadChanged();

  $.network.on('peers-changed', _onPeersChanged);

  $.network.connect();
}, function(error) {
  console.error("Error", error);
  alert("A Miner is already running in another tab")
});

// Dummy object to prevent JS errors
window.$ = {
  consensus: {
    established: false
  }
};
