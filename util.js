(function() {
    var extend = require('util')._extend,
	jStat = require('jStat').jStat

    function numCmp (a, b) { return a-b }

    function sortAscending (list) {
        return list.sort (numCmp)
    }

    function listToCounts (list) {
	var c = {}
	list.forEach (function(x) {
            c[x] = (c[x] || 0) + 1
        })
        return c
    }
    
    function removeDups (list) {
	return Object.keys (listToCounts (list))
    }

    function parseDecInt (x) {
        return parseInt (x)
    }

    function objPredicate (obj) {
        return function(x) {
            return obj[x] ? true : false
        }
    }

    function sumList (list) {
	return list.reduce (function(tot,x) { return tot+x }, 0)
    }
    
    function randomElement (list, generator) {
	generator = generator || Math
	return list.length > 0 ? list [Math.floor (generator.random() * list.length)] : undefined
    }

    function randomIndex (distrib, generator) {
	generator = generator || Math
	var sum = sumList (distrib)
	var rnd = generator.random() * sum
	for (var idx = 0; idx < distrib.length; ++idx)
	    if ((rnd -= distrib[idx]) <= 0)
		return idx
	return undefined
    }

    function iota(n) {
	var list = []
	for (var i = 0; i < n; ++i)
	    list.push(i)
	return list
    }

    function sortKeys (obj, sortFunc) {
	sortFunc = sortFunc || numCmp
	return Object.keys(obj).sort (function(a,b) {
	    return sortFunc (obj[a], obj[b])
	})
    }

    function sortIndices (list, sortFunc) {
	sortFunc = sortFunc || numCmp
	return iota(list.length).sort (function(a,b) {
	    return sortFunc (list[a], list[b])
	})
    }

    function permuteList (list, order) {
	return order.map (function(idx) { return list[idx] })
    }

    function keyValListToObj (keyValList) {
	var obj = {}
	keyValList.forEach (function (keyVal) {
	    obj[keyVal[0]] = keyVal[1]
	})
	return obj
    }

    function logBinomialCoefficient (n, k) {
	return jStat.gammaln(n+1) - jStat.gammaln(k+1) - jStat.gammaln(n-k+1)
    }
    
    function logBetaBinomial (alpha, beta, n, k) {
	return logBinomialCoefficient(n,k) + logBetaBernouilli(alpha,beta,k,n-k)
    }
    
    function logBetaBernouilli (alpha, beta, succ, fail) {
	return jStat.betaln(alpha+succ,beta+fail) - jStat.betaln(alpha,beta)
    }
    
    module.exports.numCmp = numCmp
    module.exports.sortAscending = sortAscending
    module.exports.listToCounts = listToCounts
    module.exports.removeDups = removeDups
    module.exports.parseDecInt = parseDecInt
    module.exports.objPredicate = objPredicate
    module.exports.sumList = sumList
    module.exports.randomElement = randomElement
    module.exports.randomIndex = randomIndex
    module.exports.iota = iota
    module.exports.sortIndices = sortIndices
    module.exports.permuteList = permuteList
    module.exports.keyValListToObj = keyValListToObj
    module.exports.logBetaBinomial = logBetaBinomial
    module.exports.logBetaBernouilli = logBetaBernouilli
    module.exports.extend = extend
}) ()
