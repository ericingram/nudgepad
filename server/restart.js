site.get('/nudgepad.restart', nudgepad.checkId, function(req, res, next) {
  // We rely on mon to restart
  res.send('Restarting Nudge')
  process.exit(0)
})
