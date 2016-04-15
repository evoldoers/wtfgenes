(function() {
    var extend = require('util')._extend,
        assert = require('assert'),
	jStat = require('jStat').jStat

    function numCmp (a, b) { return a-b }

    function reverseCmp (comparisonFunc) {
        return function(a,b) {
            return comparisonFunc(b,a)
        }
    }

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

    function negate (predicateFunc) {
	return function () {
            return !predicateFunc.apply(this, arguments)
	}
    }

    function sumList (list) {
	return list.reduce (function(tot,x) { return tot+x }, 0)
    }
    
    function randomElement (list, generator) {
	return list.length > 0 ? list [Math.floor (generator.random() * list.length)] : undefined
    }

    function randomIndex (distrib, generator) {
	var sum = sumList (distrib)
	var rnd = generator.random() * sum
	for (var idx = 0; idx < distrib.length; ++idx)
	    if ((rnd -= distrib[idx]) <= 0)
		return idx
	return undefined
    }

    function randomKey (obj, generator) {
	var keys = Object.keys (obj)
	var distrib = keys.map (function(k) { return obj[k] })
	return keys [randomIndex (distrib, generator)]
    }

    function iota(n) {
	var list = []
	for (var i = 0; i < n; ++i)
	    list.push(i)
	return list
    }

    function sortKeys (obj, sortFunc, keys) {
	sortFunc = sortFunc || numCmp
	return (keys || Object.keys(obj)).sort (function(a,b) {
	    return sortFunc (obj[a], obj[b])
	})
    }

    function sortIndices (order, indexList, sortFunc) {
	sortFunc = sortFunc || numCmp
	return (indexList || iota(order.length)).sort (function(a,b) {
	    return sortFunc (order[a], order[b])
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

    function values (obj) {
        return Object.keys(obj).map (function(k) { return obj[k] })
    }

    function commonKeys (obj1, obj2) {
	return Object.keys(obj1).filter (function(k) { return obj2.hasOwnProperty(k) })
    }

    function commonElements (list1, list2) {
	return commonKeys (listToCounts(list1), listToCounts(list2))
    }

    function logBinomialCoefficient (n, k) {
	return jStat.gammaln(n+1) - jStat.gammaln(k+1) - jStat.gammaln(n-k+1)
    }
    
    function logBetaBinomial (alpha, beta, n, k) {
	return logBinomialCoefficient(n,k) + logBetaBernoulli(alpha,beta,k,n-k)
    }
    
    function logBetaBernoulli (alpha, beta, succ, fail) {
	return jStat.betaln(alpha+succ,beta+fail) - jStat.betaln(alpha,beta)
    }

    function autocorrelation (list, points) {
	points = points || iota(list.length-1)
	var mean = jStat.mean(list), variance = jStat.variance(list)
	var list_minus_mean = list.map (function(x) { return x - mean })
	var R = {}
	points.forEach (function(tau) {
	    var R_tau = []
	    for (var i = 0; i + tau < list.length; ++i)
		R_tau.push (list_minus_mean[i] * list_minus_mean[i + tau])
	    R[tau] = jStat.mean(R_tau) / variance
	})
	return R
    }

    function arraysEqual (a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false
        if (a.length != b.length) return false
        for (var i = 0; i < a.length; ++i)
            if (a[i] !== b[i]) return false
        return true
    }

    function approxEqual (a, b, epsilon) {
	epsilon = epsilon || .0001
	if (Math.max (Math.abs(a), Math.abs(b)) > 0)
	    return Math.abs(a-b) / Math.max (Math.abs(a), Math.abs(b)) < epsilon
	else
	    return Math.abs(a-b) < epsilon
    }
    
    function assertApproxEqual (a, b, epsilon, message) {
	assert (approxEqual(a,b,epsilon), message || ("Difference between a ("+a+") and b ("+b+") is too large"))
    }
    
    function plural (count, singular, plural) {
        plural = plural || (singular + 's')
        return count + ' ' + (count == 1 ? singular : plural)
    }
    
    function toHHMMSS (milliseconds) {
	var sec_num = Math.floor (milliseconds / 1000)
	var hours   = Math.floor (sec_num / 3600)
	var minutes = Math.floor ((sec_num - (hours * 3600)) / 60)
	var seconds = sec_num - (hours * 3600) - (minutes * 60)

	if (hours < 10)
	    hours = "0" + hours
	if (minutes < 10)
	    minutes = "0" + minutes
	if (seconds < 10)
	    seconds = "0" + seconds

	return hours+':'+minutes+':'+seconds
    }

    function progressLogger (pastTenseVerb, pluralNoun) {
	var startTime = Date.now(), lastTime = startTime, delay = 1000
	return function (stepsCompleted, totalSteps) {
	    var nowTime = Date.now()
	    if (nowTime - lastTime > delay) {
		lastTime = nowTime
		delay = Math.min (30000, delay*2)
		var progress = stepsCompleted / totalSteps
		console.warn (pastTenseVerb + " " + stepsCompleted + "/" + totalSteps + " " + pluralNoun + " (" + Math.round(100*progress) + "%), estimated time left " + toHHMMSS ((1/progress - 1) * (nowTime - startTime)))
	    }
	}
    }

    function logRandomNumbers(generator,nMax) {
	var rnd = generator.int, nRnd = 0
	generator.int = function() {
	    var r = rnd.apply (this, arguments)
	    if (typeof(nMax) === 'undefined' || nRnd < nMax)
		console.warn ("Random number #" + (++nRnd) + ": " + r)
	    return r
	}
    }

    function HSVtoRGB(h, s, v) {
	var r, g, b, i, f, p, q, t
	i = Math.floor(h * 6)
	f = h * 6 - i
	p = v * (1 - s)
	q = v * (1 - f * s)
	t = v * (1 - (1 - f) * s)
	switch (i % 6) {
        case 0: r = v, g = t, b = p; break
        case 1: r = q, g = v, b = p; break
        case 2: r = p, g = v, b = t; break
        case 3: r = p, g = q, b = v; break
        case 4: r = t, g = p, b = v; break
        case 5: r = v, g = p, b = q; break
	}
	return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
	}
    }

    module.exports.numCmp = numCmp
    module.exports.reverseCmp = reverseCmp
    module.exports.sortAscending = sortAscending
    module.exports.listToCounts = listToCounts
    module.exports.removeDups = removeDups
    module.exports.parseDecInt = parseDecInt
    module.exports.objPredicate = objPredicate
    module.exports.negate = negate
    module.exports.sumList = sumList
    module.exports.randomElement = randomElement
    module.exports.randomIndex = randomIndex
    module.exports.randomKey = randomKey
    module.exports.iota = iota
    module.exports.sortKeys = sortKeys
    module.exports.sortIndices = sortIndices
    module.exports.permuteList = permuteList
    module.exports.keyValListToObj = keyValListToObj
    module.exports.values = values
    module.exports.commonKeys = commonKeys
    module.exports.commonElements = commonElements
    module.exports.logBinomialCoefficient = logBinomialCoefficient
    module.exports.logBetaBinomial = logBetaBinomial
    module.exports.logBetaBernoulli = logBetaBernoulli
    module.exports.autocorrelation = autocorrelation
    module.exports.arraysEqual = arraysEqual
    module.exports.approxEqual = approxEqual
    module.exports.assertApproxEqual = assertApproxEqual
    module.exports.toHHMMSS = toHHMMSS
    module.exports.plural = plural
    module.exports.progressLogger = progressLogger
    module.exports.logRandomNumbers = logRandomNumbers
    module.exports.HSVtoRGB = HSVtoRGB
    module.exports.extend = extend
}) ()
