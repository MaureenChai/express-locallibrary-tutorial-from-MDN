const BookInstance = require("../models/bookinstance");
const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
const Book = require("../models/book");

// 呈现所有书本实例（BookInstance）的列表
exports.bookinstance_list = asyncHandler(async (req, res, next) => {
  const allBookInstances = await BookInstance.find().populate("book").exec();

  res.render("bookinstance_list", {
    title: "Book Instance List",
    bookinstance_list: allBookInstances,
  });
});
// 显示特定 BookInstance 的详情页
exports.bookinstance_detail = asyncHandler(async (req, res, next) => {
  const bookInstance = await BookInstance.findById(req.params.id)
    .populate("book")
    .exec();

  if (bookInstance === null) {
    // 没有结果
    const err = new Error("Book copy not found");
    err.status = 404;
    return next(err);
  }

  res.render("bookinstance_detail", {
    title: "Book:",
    bookinstance: bookInstance,
  });
});

// 由 GET 显示创建 BookInstance 的表单
exports.bookinstance_create_get = async function (req, res, next) {
  try {
    // 获取所有书籍用于下拉选择
    const books = await Book.find({}, "title").exec();
    // 渲染表单页面
    res.render("bookinstance_form", {
      title: "Create BookInstance",
      book_list: books,
    });
  } catch (err) {
    return next(err);
  }
};

// 由 POST 处理创建 BookInstance
exports.bookinstance_create_post = [
  // Validate fields.
  body("book", "Book must be specified").isLength({ min: 1 }).trim(),
  body("imprint", "Imprint must be specified").isLength({ min: 1 }).trim(),
  body("due_back", "Invalid date").optional({ checkFalsy: true }).isISO8601(),

  // Sanitize fields.
  body("book").trim().escape(),
  body("imprint").trim().escape(),
  body("status").trim().escape(),
  body("due_back").toDate(),

  // Process request after validation and sanitization.
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a BookInstance object with escaped and trimmed data.
    const bookinstance = new BookInstance({
      book: req.body.book,
      imprint: req.body.imprint,
      status: req.body.status,
      due_back: req.body.due_back,
    });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values and error messages.
      try {
        const books = await Book.find({}, "title").exec();

        res.render("bookinstance_form", {
          title: "Create BookInstance",
          book_list: books,
          selected_book: bookinstance.book._id,
          errors: errors.array(),
          bookinstance: bookinstance,
        });
      } catch (err) {
        return next(err);
      }
    } else {
      // Data from form is valid.
      try {
        await bookinstance.save();
        // Successful - redirect to new record.
        res.redirect(bookinstance.url);
      } catch (err) {
        return next(err);
      }
    }
  },
];

// 由 GET 显示删除 BookInstance 的表单
exports.bookinstance_delete_get = asyncHandler(async (req, res, next) => {
  try {
    const bookookInstances = await BookInstance.findById(req.params.id).exec();

    // 如果没有找到，重定向到列表
    if (bookookInstances == null) {
      return res.redirect("/catalog/bookinstances");
    }

    // 渲染删除确认页面
    res.render("bookinstance_delete", {
      title: "Delete BookInstance",
      book_instance: bookookInstances,
    });
  } catch (err) {
    return next(err);
  }
});

// 由 POST 删除 BookInstance
exports.bookinstance_delete_post = asyncHandler(async (req, res, next) => {
  try {
    const bookookInstances = await BookInstance.findById(req.params.id).exec();

    // 检查是否有错误
    if (!bookookInstances) {
      return res.redirect("/catalog/bookinstances");
    }
    await BookInstance.findOneAndDelete({ _id: req.body.bookinstanceid });
    // Success - go to author list
    res.redirect("/catalog/bookinstances");
  } catch (err) {
    return next(err);
  }
});

// 由 GET 显示更新 BookInstance 的表单
exports.bookinstance_update_get = asyncHandler(async (req, res, next) => {
  try {
    // 获取所有书籍用于下拉选择
    const [books, bookinstance] = await Promise.all([
      // 1. 查询要编辑的书
      Book.find({}, "title").exec(),
      // 3. 查询所有分类
      BookInstance.findById(req.params.id).exec(),
    ]);

    // 渲染表单页面
    res.render("bookinstance_form", {
      title: "Update BookInstance",
      book_list: books,
      bookinstance: {
        ...bookinstance.toObject(),
        due_back: bookinstance.due_back
          ? bookinstance.due_back.toISOString().split("T")[0]
          : "",
      },
    });
  } catch (err) {
    return next(err);
  }
});

// 由 POST 处理更新 BookInstance
exports.bookinstance_update_post = [
  // Validate fields.
  body("book", "Book must be specified").isLength({ min: 1 }).trim(),
  body("imprint", "Imprint must be specified").isLength({ min: 1 }).trim(),
  body("due_back", "Invalid date").optional({ checkFalsy: true }).isISO8601(),

  // Sanitize fields.
  body("book").trim().escape(),
  body("imprint").trim().escape(),
  body("status").trim().escape(),
  body("due_back").toDate(),

  // Process request after validation and sanitization.
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a BookInstance object with escaped and trimmed data.
    const bookinstance = new BookInstance({
      book: req.body.book,
      imprint: req.body.imprint,
      status: req.body.status,
      due_back: req.body.due_back,
      _id: req.params.id,
    });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values and error messages.
      try {
        const books = await Book.find({}, "title").exec();

        res.render("bookinstance_form", {
          title: "Update BookInstance",
          book_list: books,
          selected_book: bookinstance.book._id,
          errors: errors.array(),
          bookinstance: bookinstance,
        });
      } catch (err) {
        return next(err);
      }
    } else {
      // Data from form is valid.
      try {
        const updatedBookInstance = await BookInstance.findByIdAndUpdate(
          req.params.id,
          bookinstance,
          {
            new: true,
            runValidators: true,
          },
        ).exec();
        // Success - redirect to book detail page
        res.redirect(updatedBookInstance.url);
      } catch (err) {
        return next(err);
      }
    }
  },
];
