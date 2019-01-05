import OffsetSource from '@atjson/offset-annotations';
import * as fs from 'fs';
import * as path from 'path';
import GDocsSource from '../src';

describe('@atjson/source-gdocs-paste', () => {
  var atjson: OffsetSource;

  beforeAll(() => {
    // https://docs.google.com/document/d/18pp4dAGx5II596HHGOLUXXcc6VKLAVRBUMLm9Ge8eOE/edit?usp=sharing
    let fixturePath = path.join(__dirname, 'fixtures', 'complex.json');
    let rawJSON = JSON.parse(fs.readFileSync(fixturePath).toString());
    let gdocs = GDocsSource.fromRaw(rawJSON);
    atjson = gdocs.convertTo(OffsetSource);
  });

  it('correctly converts -gdocs-ts_bd to bold', () => {
    let bolds = atjson.where(a => a.type === 'bold');
    expect(bolds.length).toEqual(2);
  });

  it('correctly converts italic', () => {
    let italics = atjson.where(a => a.type === 'italic');
    expect(italics.length).toEqual(2);
  });

  it('correctly converts headings', () => {
    let headings = atjson.where(a => a.type === 'heading');
    expect(headings.length).toEqual(4);
    expect(headings.map(h => h.attributes.level)).toEqual([1, 2, 100, 101]);
  });

  it('correctly converts lists', () => {
    let lists = atjson.where(a => a.type === 'list');
    expect(lists.length).toEqual(2);
  });

  it('correctly converts numbered lists', () => {
    let lists = atjson.where(a => a.type === 'list' && a.attributes.type === 'numbered')
    expect(lists.length).toEqual(1);
  });

  it('correctly converts bulleted lists', () => {
    let lists = atjson.where(a => a.type === 'list' && a.attributes.type === 'bulleted');
    expect(lists.length).toEqual(1);
  });

  it('correctly converts list-items', () => {
    let listItems = atjson.where(a => a.type === 'list-item');
    expect(listItems.length).toEqual(4);
  });

  it('correctly converts links', () => {
    let links = atjson.where(a => a.type === 'link');
    expect(links.length).toEqual(1);
    expect(links.map(link => link.attributes.url)).toEqual(['https://www.google.com/']);
  });

  it('removes underlined text aligned exactly with links', () => {
    // https://docs.google.com/document/d/18pp4dAGx5II596HHGOLUXXcc6VKLAVRBUMLm9Ge8eOE/edit?usp=sharing
    let fixturePath = path.join(__dirname, 'fixtures', 'underline.json');
    let rawJSON = JSON.parse(fs.readFileSync(fixturePath).toString());
    let gdocs = GDocsSource.fromRaw(rawJSON);
    let doc = gdocs.convertTo(OffsetSource);

    let links = doc.where({ type: '-offset-link' }).as('links');
    let underlines = doc.where({ type: '-offset-underline' }).as('underline');

    expect(
      links.join(underlines, (a, b) => a.isAlignedWith(b)).length
    ).toBe(0);
  });
});

describe('@atjson/source-gdocs-paste paragraphs', () => {
  let atjson: OffsetSource;

  const LINEBREAKS = [
    [ 21, 22],
    [ 70, 71 ],
    [ 249, 250 ],
    [ 370, 371 ]
  ].map(([start, end]) => {
    return {
      start,
      end,
      type: '-offset-line-break',
      attributes: {},
      id: 'Any<id>'
    };
  });

  const PARAGRAPHS = [
    [ 0, 117 ],
    [ 119, 163 ],
    [ 166, 214 ],
    [ 214, 284 ],
    [ 286, 324 ],
    [ 406, 446 ],
    [ 448, 486 ]
  ].map(([start, end]) => {
    return {
      start,
      end,
      type: '-offset-paragraph',
      attributes: {},
      id: 'Any<id>'
    };
  });

  const LIST = {
    start: 214,
    end: 486,
    type: '-offset-list',
    attributes: { '-offset-type': 'numbered' },
    id: 'Any<id>'
  };

  const LIST_ITEMS = [
    [ 214, 324 ],
    [ 325, 405 ],
    [ 406, 486 ]
  ].map(([start, end]) => {
    return {
      start,
      end,
      type: '-offset-list-item',
      attributes: {},
      id: 'Any<id>'
    };
  });

  beforeAll(() => {
    // https://docs.google.com/document/d/1PzhE6OJqRIHrDZcXBjw7UsjUhH_ITPP7tgg2s9fhPf4/edit
    let fixturePath = path.join(__dirname, 'fixtures', 'paragraphs.json');
    let rawJSON = JSON.parse(fs.readFileSync(fixturePath).toString());
    let gdocs = GDocsSource.fromRaw(rawJSON);
    atjson = gdocs.convertTo(OffsetSource);
  });

  it('removes all vertical tabs', () => {
    expect(atjson.match(/\u000b/g)).toEqual([]);
  });

  it('created three paragraphs before the list', () => {
    let listsAndParagraphs = atjson.where({ type: '-offset-list' }).as('list')
      .join(
        atjson.where({ type: '-offset-paragraph'}).as('paragraphs'),
        (l, r) => r.end <= l.start
      );

    expect(listsAndParagraphs.toJSON()[0]).toEqual({
      list: LIST,
      paragraphs: PARAGRAPHS.slice(0, 3)
    });
  });

  it('created first paragraph with two nested linebreaks', () => {
    let firstParagraph = atjson.where({ type: '-offset-paragraph' }).as('paragraph')
      .join(
        atjson.where({ type: '-offset-line-break' }).as('linebreaks'),
        (l, r) => r.start > l.start && r.end < l.end
      ).toJSON()[0];

    expect(firstParagraph).toEqual({
      paragraph: PARAGRAPHS[0],
      linebreaks: LINEBREAKS.slice(0, 2)
    });
  });

  it('created linebreaks inside list-items', () => {
    let linebreaks = atjson.where({ type: '-offset-line-break' }).as('linebreak');

    expect(linebreaks.toJSON()).toEqual(LINEBREAKS);

    let linebreaksInLists = linebreaks
      .join(
        atjson.where({ type: '-offset-list' }).as('lists'),
        (l, r) => l.start >= r.start && l.end <= r.end
      ).outerJoin(
        atjson.where({ type: '-offset-list-item' }).as('list-items'),
        (l, r) => l.linebreak.start >= r.start && l.linebreak.end <= r.end
      );

    // No linebreaks in a list outside of a list-item
    expect(linebreaksInLists.where(join => join.lists.length > 0 && join['list-items'].length === 0).toJSON()).toHaveLength(0);
    expect(linebreaksInLists.toJSON()).toEqual([
      {
        linebreak: LINEBREAKS[2],
        lists: [ LIST ],
        'list-items': [ LIST_ITEMS[0] ]
      }, {
        linebreak: LINEBREAKS[3],
        lists: [ LIST ],
        'list-items': [ LIST_ITEMS[1] ]
      }
    ]);
  });

  it('created paragraphs inside list-items', () => {
    let paragraphs = atjson.where({ type: '-offset-paragraph' }).as('paragraph');

    expect(paragraphs.toJSON()).toEqual(PARAGRAPHS);

    let paragraphsInLists = paragraphs
      .join(
        atjson.where({ type: '-offset-list' }).as('lists'),
        (l, r) => l.start >= r.start && l.end <= r.end
      ).outerJoin(
        atjson.where({ type: '-offset-list-item' }).as('list-items'),
        (l, r) => l.paragraph.start >= r.start && l.paragraph.end <= r.end
      );

    // No paragraphs in a list outside of a list-item
    expect(paragraphsInLists.where(join => join.lists.length > 0 && join['list-items'].length === 0).toJSON()).toHaveLength(0);
    expect(paragraphsInLists.toJSON()).toEqual([
      {
        paragraph: PARAGRAPHS[3],
        lists: [ LIST ],
        'list-items': [ LIST_ITEMS[0] ]
      }, {
        paragraph: PARAGRAPHS[4],
        lists: [ LIST ],
        'list-items': [ LIST_ITEMS[0] ]
      }, {
        paragraph: PARAGRAPHS[5],
        lists: [ LIST ],
        'list-items': [ LIST_ITEMS[2] ]
      }, {
        paragraph: PARAGRAPHS[6],
        lists: [ LIST ],
        'list-items': [ LIST_ITEMS[2] ]
      }
    ]);
  });
});
