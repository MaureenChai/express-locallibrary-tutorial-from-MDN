const Book = require("../models/book");
const Author = require("../models/author");
const Genre = require("../models/genre");
const BookInstance = require("../models/bookinstance");
const { body, validationResult } = require("express-validator");

const asyncHandler = require("express-async-handler");

exports.index = asyncHandler(async (req, res, next) => {
  // 并行获取书的详细信息、书实例、作者和体裁的数量
  const [
    numBooks,
    numBookInstances,
    numAvailableBookInstances,
    numAuthors,
    numGenres,
  ] = await Promise.all([
    Book.countDocuments({}).exec(),
    BookInstance.countDocuments({}).exec(),
    BookInstance.countDocuments({ status: "Available" }).exec(),
    Author.countDocuments({}).exec(),
    Genre.countDocuments({}).exec(),
  ]);

  res.render("index", {
    title: "Local Library Home",
    book_count: numBooks,
    book_instance_count: numBookInstances,
    book_instance_available_count: numAvailableBookInstances,
    author_count: numAuthors,
    genre_count: numGenres,
  });
});

// 显示所有的图书
exports.book_list = asyncHandler(async (req, res, next) => {
  const allBooks = await Book.find({}, "title author")
    .sort({ title: 1 })
    .populate("author")
    .exec();

  res.render("book_list", { title: "Book List", book_list: allBooks });
});

// 显示特定图书的详情页面
exports.book_detail = asyncHandler(async (req, res, next) => {
  // 获取书籍的详细信息，以及特定书籍的实例
  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    // 没有结果
    const err = new Error("Book not found");
    err.status = 404;
    return next(err);
  }

  res.render("book_detail", {
    title: book.title,
    book: book,
    book_instances: bookInstances,
  });
});

// 通过 GET 显示创建图书
exports.book_create_get = async function (req, res, next) {
  try {
    // 并行获取作者和类型数据
    const [authors, genres] = await Promise.all([
      Author.find().exec(),
      Genre.find().exec(),
    ]);

    res.render("book_form", {
      title: "Create Book",
      authors: authors,
      genres: genres,
    });
  } catch (err) {
    return next(err);
  }
};

// 以 POST 方式处理创建图书
exports.book_create_post = [
  // Convert the genre to an array.
  (req, res, next) => {
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === "undefined") req.body.genre = [];
      else req.body.genre = new Array(req.body.genre);
    }
    next();
  },

  // Validate fields.
  body("title", "Title must not be empty.").isLength({ min: 1 }).trim(),
  body("author", "Author must not be empty.").isLength({ min: 1 }).trim(),
  body("summary", "Summary must not be empty.").isLength({ min: 1 }).trim(),
  body("isbn", "ISBN must not be empty").isLength({ min: 1 }).trim(),

  // Sanitize fields (using wildcard).
  body("*").trim().escape(),
  body("genre.*").escape(),
  // Process request after validation and sanitization.
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a Book object with escaped and trimmed data.
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: req.body.genre,
    });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      try {
        // Get all authors and genres for form using Promise.all for parallel execution
        const [authors, genres] = await Promise.all([
          Author.find().exec(),
          Genre.find().exec(),
        ]);

        // Mark our selected genres as checked.
        for (let i = 0; i < genres.length; i++) {
          if (book.genre.indexOf(genres[i]._id) > -1) {
            genres[i].checked = "true";
          }
        }

        res.render("book_form", {
          title: "Create Book",
          authors: authors,
          genres: genres,
          book: book,
        });
      } catch (err) {
        return next(err);
      }
    } else {
      // Data from form is valid. Save book.
      try {
        await book.save();
        // Successful - redirect to new book record.
        res.redirect(book.url);
      } catch (err) {
        return next(err);
      }
    }
  },
];

// 通过 GET 显示删除图书
exports.book_delete_get = asyncHandler(async (req, res, next) => {
  try {
    const [book, bookInstances] = await Promise.all([
      Book.findById(req.params.id).populate("author").populate("genre").exec(),
      BookInstance.find({ book: req.params.id }).exec(),
    ]);

    // 如果没有找到，重定向到书本列表
    if (book == null) {
      return res.redirect("/catalog/books");
    }

    // 渲染删除确认页面
    res.render("book_delete", {
      title: "Delete Book",
      book: book,
      book_instances: bookInstances,
    });
  } catch (err) {
    return next(err);
  }
});

// 以 POST 方式处理删除图书
exports.book_delete_post = asyncHandler(async (req, res, next) => {
  try {
    const [book, bookInstances] = await Promise.all([
      Book.findById(req.params.id).populate("author").populate("genre").exec(),
      BookInstance.find({ book: req.params.id }).exec(),
    ]);

    // 检查是否有错误
    if (!book) {
      return res.redirect("/catalog/books");
    }

    // Success
    if (bookInstances.length > 0) {
      // Author has books. Render in same way as for GET route.
      return res.render("book_delete", {
        title: "Delete Book",
        book: book,
        book_instances: bookInstances,
      });
    } else {
      // Author has no books. Delete object and redirect to the list of authors.
      await Book.findOneAndDelete({ _id: req.body.bookid });
      // Success - go to author list
      res.redirect("/catalog/books");
    }
  } catch (err) {
    return next(err);
  }
});

// 通过 GET 显示更新图书
exports.book_update_get = async function (req, res, next) {
  try {
    // 使用 Promise.all 并行查询
    const [book, authors, genres] = await Promise.all([
      // 1. 查询要编辑的书
      Book.findById(req.params.id).populate("author").populate("genre").exec(),

      // 2. 查询所有作者
      Author.find().exec(),

      // 3. 查询所有分类
      Genre.find().exec(),
    ]);

    // 如果没有找到这本书
    if (!book) {
      const err = new Error("Book not found");
      err.status = 404;
      return next(err);
    }

    // 标记已选中的 genre（给表单勾选）
    genres.forEach((genre) => {
      if (
        book.genre.some(
          (bookGenre) => bookGenre._id.toString() === genre._id.toString(),
        )
      ) {
        genre.checked = true;
      }
    });

    // 渲染表单
    res.render("book_form", {
      title: "Update Book",
      authors: authors,
      genres: genres,
      book: book,
    });
  } catch (err) {
    return next(err);
  }
};

// 处理 POST 时的更新图书
exports.book_update_post = [
  (req, res, next) => {
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === "undefined") req.body.genre = [];
      else req.body.genre = new Array(req.body.genre);
    }
    next();
  },
  // Validate fields.
  body("title", "Title must not be empty.").isLength({ min: 1 }).trim(),
  body("author", "Author must not be empty.").isLength({ min: 1 }).trim(),
  body("summary", "Summary must not be empty.").isLength({ min: 1 }).trim(),
  body("isbn", "ISBN must not be empty").isLength({ min: 1 }).trim(),

  // Sanitize fields.
  body("title").trim().escape(),
  body("author").trim().escape(),
  body("summary").trim().escape(),
  body("isbn").trim().escape(),
  body("genre.*").trim().escape(),
  async (req, res, next) => {
    try {
      // Extract the validation errors from a request.
      const errors = validationResult(req);

      // Create a Book object with escaped/trimmed data and old id.
      const book = new Book({
        title: req.body.title,
        author: req.body.author,
        summary: req.body.summary,
        isbn: req.body.isbn,
        genre: typeof req.body.genre === "undefined" ? [] : req.body.genre,
        _id: req.params.id, //This is required, or a new ID will be assigned!
      });

      if (!errors.isEmpty()) {
        // There are errors. Render form again with sanitized values/error messages.
        const [authors, genres] = await Promise.all([
          Author.find().exec(),
          Genre.find().exec(),
        ]);

        // Mark selected genres
        genres.forEach((genre) => {
          if (book.genre.includes(genre._id.toString())) {
            genre.checked = true;
          }
        });

        res.render("book_form", {
          title: "Update Book",
          authors: authors,
          genres: genres,
          book: book,
          errors: errors.array(),
        });
        return;
      } else {
        // Data is valid → UPDATE
        const updatedBook = await Book.findByIdAndUpdate(req.params.id, book, {
          new: true,
          runValidators: true,
        }).exec();
        // Success - redirect to book detail page
        res.redirect(updatedBook.url);
      }
    } catch (err) {
      return next(err);
    }
  },
];
