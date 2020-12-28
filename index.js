const fs = require('fs'),
      express = require('express'),
      pug = require('pug'),
      md = require('markdown-it')().use(plugin),
      path = require('path');

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

function plugin (md, options) {
    md.core.ruler.push('named_headings', namedHeadings.bind(null, md))
  }

  function setAttr (token, attr, value, options) {
    var idx = token.attrIndex(attr)
  
    if (idx === -1) {
      token.attrPush([ attr, value ])
    } else if (options && options.append) {
      token.attrs[idx][1] =
        token.attrs[idx][1] + ' ' + value
    } else {
      token.attrs[idx][1] = value
    }
  }
  
  function namedHeadings (md, state) {
  
    state.tokens.forEach(function (token, i) {
      if (token.type === 'heading_open') {
        var text = md.renderer.render(state.tokens[i + 1].children, md.options)
        setAttr(token, 'id', text.toLowerCase().replaceAll(" ", "-"))
      }
    })
  }

var app = express();

app.set('view engine', 'pug');

app.use(express.static(__dirname + '/public'));


function walk(dir) {
    if(!dirList) var dirList = []
    var results = [];
    const list = fs.readdirSync(dir);
    list.forEach((fileName) => {
        file = dir + '/' + fileName;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !fileName.startsWith('.')) { 
            results = results.concat(walk(file)[0]);
            dirList.push(fileName);
        } else if(fileName.startsWith('.')) {
        } else { 
            results.push(file);
        }
    })
    return [results, dirList]
}

var dirList = walk('Universe')[1]

var paths = walk('Universe')[0].filter(function(path) { return path.endsWith(".md") }).map(function(path) { return path.slice(0, -3).split('/'); })

function structurize(paths) {
    var items = [];
    for(var i = 0, l = paths.length; i < l; i++) {
        var path = paths[i];
        var name = path[0];
        var rest = path.slice(1);
        var item = null;
        for(var j = 0, m = items.length; j < m; j++) {
            if(items[j].name === name) {
                item = items[j];
                break;
            }
        }
        if(item === null) {
            item = {name: name, children: []};
            items.push(item);
        }
        if(rest.length > 0) {
            item.children.push(rest);
        }
    }
    for(i = 0, l = items.length; i < l; i++) {
        item = items[i];
        item.children = structurize(item.children);
    }
    return items;
}

function stringify(items) {
    var lines = [];
    for(var i = 0, l = items.length; i < l; i++) {
        var item = items[i];
        if(dirList.includes(item.name) || item.name == "Universe"){
            lines.push(`- ${item.name}`);
        } else {
            lines.push(`- [${item.name}](./${encodeURIComponent(item.name)})`);
        }
        
        var subLines = stringify(item.children);
        for(var j = 0, m = subLines.length; j < m; j++) {
            lines.push("  " + subLines[j]);
        }
    }
    return lines;
};

var dirTree = stringify(structurize(paths)).join("\n");

function convertMd(data) {
    data = data.replace( /\[\[+([^\$\n]+?)(?:\|([^\$\n]+?))?\]\]+/g, (match, p1, p2, offset, string) => {
        return `[${p2 == undefined ? p1 : p2}](./${encodeURI(p1).replaceAll("%23", "#")})`
    })
    .replace( /\[\[+([^\$\n]+?)(?:\|([^\$\n]+?))?\]\]+/g, (match, p1, p2, offset, string) => {
        return `[${p2 == undefined ? p1 : p2}](./${encodeURI(p1).replaceAll("%23", "#")})`
    })
    .replace(/(?<=\[[\s\S]*\]\(.*#)(.*)(?=\))/g, (match, p1, p2, offset, string) => {
        return `${p1.toLowerCase().replace("%20", "-")}`
    })

    return md.render(data)
}

function parse(fileName) {
    var page = {
        title: "",
        content: "",
        URl: ""
    };

    page.title = fileName.split('/')[fileName.split('/').length - 1].slice(0, -3);
    page.content = fs.readFileSync(fileName, {encoding: 'utf-8'});
    page.URl = encodeURIComponent(page.title);
    page.html = convertMd(page.content);

    return page
}

var files = walk('Universe')[0],
    markdowns = files.filter((a) => {return a.endsWith('.md')}),
    assets = files.filter((a) => {return a.endsWith('.png')});

console.log(dirList)

markdowns.forEach(file => {
    var page = parse(file)
    
    app.get(`/${page.URl}`, (req, res) => {
        res.render('article', page)
    })
})

assets.forEach(file => {
    app.get(`/${file.split('/')[file.split('/').length - 1]}`, (req, res) => {
        res.sendFile(path.join(__dirname, file))
    })
})

app.get(`/`, (req, res) => {
    res.render('homepage', { html: md.render(dirTree) })
})

app.listen(8080);

